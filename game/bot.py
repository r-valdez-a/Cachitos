"""
Bot player AI for Cachitos
Bots make decisions based on probability calculations with personality traits
"""
import random
from typing import Dict, List, Optional, Tuple
from .probability import (
    calculate_bet_probability_known,
    calculate_bet_probability_unknown,
    get_die_probability
)
from .bet_validator import BetValidator


class BotPersonality:
    """Personality traits that affect bot decision making"""
    
    def __init__(self, name: str = None):
        # Random personality traits (0.0 to 1.0)
        self.aggression = random.uniform(0.2, 0.8)  # Higher = more likely to bluff/raise aggressively
        self.risk_tolerance = random.uniform(0.2, 0.8)  # Higher = less likely to doubt early
        self.calzo_tendency = random.uniform(0.03, 0.12)  # REDUCED: Higher = more likely to attempt calzo
        self.bluff_frequency = random.uniform(0.05, 0.15)  # Chance to make a random/bluff move
        
        # Personality name
        self.name = name or self._generate_personality_name()
    
    def _generate_personality_name(self) -> str:
        """Generate a descriptive personality name"""
        if self.aggression > 0.6 and self.risk_tolerance > 0.6:
            return "Aggressive"
        elif self.aggression < 0.4 and self.risk_tolerance < 0.4:
            return "Cautious"
        elif self.calzo_tendency > 0.08:
            return "Gambler"
        elif self.bluff_frequency > 0.12:
            return "Bluffer"
        else:
            return "Balanced"


class BotPlayer:
    """Bot AI that makes decisions in Cachitos"""
    
    # Decision thresholds
    BASE_DOUBT_THRESHOLD = 0.35  # Doubt if probability below this
    BASE_RAISE_SAFE_THRESHOLD = 0.55  # Safe to raise if above this
    BASE_CALZO_THRESHOLD = 0.22  # INCREASED: Consider calzo if exact probability above this
    
    # 1v1 adjustments
    ONEVSONE_DOUBT_BOOST = 0.15  # More likely to doubt in 1v1
    ONEVSONE_AGGRESSION_REDUCTION = 0.3  # Less aggressive betting in 1v1
    
    def __init__(self, player_id: str, name: str):
        self.player_id = player_id
        self.name = name
        self.personality = BotPersonality()
        self.is_bot = True
    
    def decide_action(
        self,
        my_dice: List[int],
        total_dice: int,
        current_bet: Optional[Dict],
        players_info: List[Dict],
        is_palo_fijo: bool = False,
        palo_fijo_value: int = None,
        round_bet_history: List[Dict] = None,
        painted_dice: List[int] = None,
        alive_players: int = 2
    ) -> Dict:
        """
        Decide what action to take
        
        Returns:
            Dict with 'action' ('bet', 'doubt', 'calzo') and relevant data
        """
        round_bet_history = round_bet_history or []
        painted_dice = painted_dice or []
        
        # Calculate if we're in 1v1 mode
        is_one_vs_one = alive_players == 2
        
        # Adjust thresholds for 1v1
        doubt_threshold = self.BASE_DOUBT_THRESHOLD * (1 - self.personality.risk_tolerance * 0.5)
        if is_one_vs_one:
            doubt_threshold += self.ONEVSONE_DOUBT_BOOST
        
        # Infer opponent holdings from their bets
        inferred_opponent_dice = self._infer_opponent_dice(round_bet_history, my_dice)
        
        # Random bluff/chaos decision (less likely in 1v1)
        bluff_chance = self.personality.bluff_frequency
        if is_one_vs_one:
            bluff_chance *= 0.5
        
        if random.random() < bluff_chance:
            return self._make_random_decision(
                my_dice, total_dice, current_bet, 
                is_palo_fijo, palo_fijo_value
            )
        
        # First bet of the round - must bet
        if not current_bet:
            return self._make_opening_bet(
                my_dice, total_dice, 
                is_palo_fijo, palo_fijo_value,
                is_one_vs_one
            )
        
        # Calculate probability of current bet being true
        # Consider known dice (mine + painted)
        known_dice = my_dice + painted_dice
        
        prob_info = calculate_bet_probability_known(
            total_dice, known_dice,
            current_bet['count'], current_bet['value'],
            is_palo_fijo=is_palo_fijo
        )
        prob_at_least = prob_info['at_least']
        
        # Adjust probability based on inferred opponent holdings
        if inferred_opponent_dice and current_bet['value'] in inferred_opponent_dice:
            # If we think opponent has these dice, probability is higher
            inferred_count = inferred_opponent_dice.get(current_bet['value'], 0)
            # Slightly boost our confidence in the bet
            prob_at_least = min(1.0, prob_at_least + inferred_count * 0.05)
        
        # Get exact probability for calzo consideration
        prob_exact = prob_info.get('exact', 0)
        
        # Adjust thresholds based on personality
        calzo_threshold = self.BASE_CALZO_THRESHOLD * (1 + self.personality.calzo_tendency)
        
        # Decision logic
        
        # 1. Consider CALZO (very rarely - only when desperate or very confident)
        my_dice_count = len(my_dice)
        is_desperate = my_dice_count <= 2
        
        if prob_exact > calzo_threshold:
            # Only calzo if desperate OR very high probability AND random check passes
            calzo_chance = self.personality.calzo_tendency
            if is_desperate:
                calzo_chance *= 3  # Triple chance when desperate
            if prob_exact > 0.25:
                calzo_chance *= 2  # Double chance when very likely
            
            if random.random() < calzo_chance:
                return {'action': 'calzo'}
        
        # 2. Consider DOUBT if probability is low
        if prob_at_least < doubt_threshold:
            # More likely to doubt if we're confident it's a bluff
            doubt_chance = 1 - (prob_at_least / doubt_threshold)
            
            # In 1v1, be more willing to doubt
            if is_one_vs_one:
                doubt_chance += 0.1
            
            if random.random() < doubt_chance * 0.8 + 0.2:
                return {'action': 'doubt'}
        
        # 3. Otherwise, RAISE the bet
        return self._make_raise_bet(
            my_dice, total_dice, current_bet,
            is_palo_fijo, palo_fijo_value,
            is_one_vs_one, inferred_opponent_dice,
            known_dice,
            is_palo_fijo
        )
    
    def _infer_opponent_dice(
        self, 
        round_bet_history: List[Dict], 
        my_dice: List[int]
    ) -> Dict[int, int]:
        """
        Infer what dice opponents might have based on their bets
        Returns estimated count per value
        """
        inferred = {}
        
        for bet_entry in round_bet_history:
            if bet_entry.get('playerId') == self.player_id:
                continue  # Skip our own bets
            
            bet = bet_entry.get('bet', {})
            value = bet.get('value')
            count = bet.get('count', 0)
            
            if value:
                # Assume player has ~50-70% of what they're claiming
                estimated_have = max(1, int(count * random.uniform(0.4, 0.6)))
                inferred[value] = max(inferred.get(value, 0), estimated_have)
                
                # If they painted, we know exactly what they showed
                painted = bet_entry.get('painted', [])
                if painted:
                    for die in painted:
                        inferred[die] = inferred.get(die, 0) + 1
        
        return inferred
    
    def _make_opening_bet(
        self, 
        my_dice: List[int], 
        total_dice: int,
        is_palo_fijo: bool,
        palo_fijo_value: int,
        is_one_vs_one: bool
    ) -> Dict:
        """Make the first bet of the round"""
        # Count what we have
        counts = {}
        for die in my_dice:
            counts[die] = counts.get(die, 0) + 1
        
        # In Palo Fijo, we must bet on the locked value (or set it)
        if is_palo_fijo and palo_fijo_value:
            best_value = palo_fijo_value
            best_count = counts.get(palo_fijo_value, 0)
        else:
            # Find our best value (most frequent, preferring non-1s)
            best_value = 6
            best_count = 0
            for value in range(2, 7):
                # In Palo Fijo, 1s don't count as wild
                if is_palo_fijo:
                    total = counts.get(value, 0)
                else:
                    total = counts.get(value, 0) + counts.get(1, 0)
                if total > best_count:
                    best_count = total
                    best_value = value
        
        # Estimate a reasonable bet
        expected_others = int((total_dice - len(my_dice)) * get_die_probability(best_value))
        safe_bet = best_count + max(0, expected_others - 1)
        
        # Add some aggression (less in 1v1)
        aggression_factor = self.personality.aggression
        if is_one_vs_one:
            aggression_factor *= (1 - self.ONEVSONE_AGGRESSION_REDUCTION)
        
        if random.random() < aggression_factor:
            safe_bet += 1
        
        safe_bet = max(1, min(safe_bet, total_dice))
        
        return {
            'action': 'bet',
            'count': safe_bet,
            'value': best_value
        }
    
    def _make_raise_bet(
        self,
        my_dice: List[int],
        total_dice: int,
        current_bet: Dict,
        is_palo_fijo: bool,
        palo_fijo_value: int,
        is_one_vs_one: bool,
        inferred_opponent_dice: Dict[int, int],
        known_dice: List[int],
        palo_fijo_flag: bool = False
    ) -> Dict:
        """Make a raised bet"""
        current_count = current_bet['count']
        current_value = current_bet['value']
        
        # In Palo Fijo, only count can change
        if is_palo_fijo:
            new_count = current_count + 1
            if new_count <= total_dice:
                prob = calculate_bet_probability_known(
                    total_dice, known_dice, new_count, current_value,
                    is_palo_fijo=True
                )
                if prob['at_least'] > 0.2 or (is_one_vs_one and prob['at_least'] > 0.15):
                    return {
                        'action': 'bet',
                        'count': new_count,
                        'value': current_value
                    }
            # If raising seems bad, doubt
            return {'action': 'doubt'}
        
        # Normal betting
        
        # Count what we have for each value
        my_counts = {}
        for die in my_dice:
            my_counts[die] = my_counts.get(die, 0) + 1
        
        # Find best raise options and evaluate them
        best_option = None
        best_prob = 0
        
        # Minimum acceptable probability (higher in 1v1 for safety)
        min_prob = 0.2 if not is_one_vs_one else 0.3
        
        # Option 1: Same value, count + 1
        new_count = current_count + 1
        if new_count <= total_dice:
            prob = calculate_bet_probability_known(
                total_dice, known_dice, new_count, current_value,
                is_palo_fijo=palo_fijo_flag
            )
            if prob['at_least'] > best_prob:
                best_prob = prob['at_least']
                best_option = {'count': new_count, 'value': current_value}
        
        # Option 2: Higher value, same count
        for value in range(current_value + 1, 7):
            prob = calculate_bet_probability_known(
                total_dice, known_dice, current_count, value,
                is_palo_fijo=palo_fijo_flag
            )
            if prob['at_least'] > best_prob:
                best_prob = prob['at_least']
                best_option = {'count': current_count, 'value': value}
        
        # Option 3: Lower value, count + 1
        for value in range(2, current_value):
            new_count = current_count + 1
            if new_count <= total_dice:
                prob = calculate_bet_probability_known(
                    total_dice, known_dice, new_count, value,
                    is_palo_fijo=palo_fijo_flag
                )
                if prob['at_least'] > best_prob:
                    best_prob = prob['at_least']
                    best_option = {'count': new_count, 'value': value}
        
        # Option 4: Go to 1s (not available during Palo Fijo)
        if current_value != 1 and not palo_fijo_flag:
            min_ones = (current_count // 2) + 1
            if min_ones <= total_dice:
                prob = calculate_bet_probability_known(
                    total_dice, known_dice, min_ones, 1,
                    is_palo_fijo=palo_fijo_flag
                )
                if prob['at_least'] > best_prob:
                    best_prob = prob['at_least']
                    best_option = {'count': min_ones, 'value': 1}
        
        # Option 5: Go from 1s (not available during Palo Fijo)
        if current_value == 1 and not palo_fijo_flag:
            min_count = (current_count * 2) + 1
            for value in range(2, 7):
                if min_count <= total_dice:
                    prob = calculate_bet_probability_known(
                        total_dice, known_dice, min_count, value,
                        is_palo_fijo=palo_fijo_flag
                    )
                    if prob['at_least'] > best_prob:
                        best_prob = prob['at_least']
                        best_option = {'count': min_count, 'value': value}
        
        # If we found a good option, use it
        if best_option and best_prob > min_prob:
            # Sometimes be more aggressive (less in 1v1)
            aggression_factor = self.personality.aggression * 0.3
            if is_one_vs_one:
                aggression_factor *= 0.5
            
            if random.random() < aggression_factor:
                best_option['count'] = min(best_option['count'] + 1, total_dice)
            
            return {
                'action': 'bet',
                'count': best_option['count'],
                'value': best_option['value']
            }
        
        # If no good option, doubt
        return {'action': 'doubt'}
    
    def _make_random_decision(
        self,
        my_dice: List[int],
        total_dice: int,
        current_bet: Optional[Dict],
        is_palo_fijo: bool,
        palo_fijo_value: int
    ) -> Dict:
        """Make a random/bluff decision for unpredictability"""
        if not current_bet:
            # Random opening bet
            if is_palo_fijo and palo_fijo_value:
                value = palo_fijo_value
            else:
                value = random.randint(2, 6)
            count = random.randint(1, max(1, total_dice // 3))
            return {'action': 'bet', 'count': count, 'value': value}
        
        # Random choice between actions (but RARELY calzo)
        choice = random.random()
        
        if choice < 0.4:
            return {'action': 'doubt'}
        elif choice < 0.42:  # Only 2% chance of random calzo
            return {'action': 'calzo'}
        else:
            # Random raise
            if is_palo_fijo:
                new_count = current_bet['count'] + random.randint(1, 2)
                new_value = current_bet['value']
            else:
                new_count = current_bet['count'] + random.randint(1, 2)
                new_value = random.randint(2, 6)
            
            # Make sure it's valid
            validation = BetValidator.validate_bet(
                current_bet,
                {'count': new_count, 'value': new_value},
                total_dice,
                is_palo_fijo,
                palo_fijo_value
            )
            
            if validation['valid']:
                return {'action': 'bet', 'count': new_count, 'value': new_value}
            else:
                # Fallback to safe increment
                return {
                    'action': 'bet',
                    'count': min(current_bet['count'] + 1, total_dice),
                    'value': current_bet['value']
                }


# Bot name generator - (emoji, name) tuples
BOT_NAMES = [
    ("🤖", "Robo"), ("🎰", "Lucky"), ("🎲", "Dicer"), ("🃏", "Joker"), ("🎯", "Ace"),
    ("🦊", "Fox"), ("🐺", "Wolf"), ("🦅", "Eagle"), ("🐍", "Viper"), ("🦁", "Leo"),
    ("⭐", "Star"), ("🔥", "Blaze"), ("❄️", "Frost"), ("⚡", "Spark"), ("🌙", "Luna")
]

def generate_bot_name(used_names: List[str] = None) -> Tuple[str, str]:
    """Generate a unique bot name. Returns (emoji, name) tuple."""
    used_names = used_names or []
    available = [(emoji, name) for emoji, name in BOT_NAMES if name not in used_names]
    
    if available:
        return random.choice(available)
    else:
        # Generate numbered name
        return ("🤖", f"Bot-{random.randint(100, 999)}")
