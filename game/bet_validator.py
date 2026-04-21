"""
Bet validation logic for Cachitos
Handles all betting rules including Palo Fijo
"""


class BetValidator:
    @staticmethod
    def validate_bet(current_bet: dict, new_bet: dict, total_dice: int, 
                     is_palo_fijo: bool = False, palo_fijo_value: int = None) -> dict:
        """
        Validate if a new bet is valid given the current bet
        
        Args:
            current_bet: The current bet {count, value} or None if first bet
            new_bet: The proposed new bet {count, value}
            total_dice: Total dice in play
            is_palo_fijo: Whether this is a Palo Fijo round
            palo_fijo_value: The locked value for Palo Fijo (None if not set yet)
        
        Returns:
            {valid: bool, reason: str}
        """
        new_count = new_bet.get('count', 0)
        new_value = new_bet.get('value', 0)
        
        # Basic validation
        if not isinstance(new_count, (int, float)) or new_count < 1:
            return {'valid': False, 'reason': 'Count must be at least 1'}
        
        new_count = int(new_count)
        new_value = int(new_value)
        
        if new_value < 1 or new_value > 6:
            return {'valid': False, 'reason': 'Value must be between 1 and 6'}
        
        if new_count > total_dice:
            return {'valid': False, 'reason': f'Count cannot exceed total dice ({total_dice})'}
        
        # Palo Fijo validation
        if is_palo_fijo and palo_fijo_value is not None:
            if new_value != palo_fijo_value:
                return {
                    'valid': False, 
                    'reason': f'Palo Fijo round! Must bet on {palo_fijo_value}s only'
                }
        
        # First bet of the round - any valid bet is okay
        if current_bet is None:
            return {'valid': True, 'reason': ''}
        
        old_count = current_bet['count']
        old_value = current_bet['value']
        
        # Palo Fijo: only count can increase (value is locked)
        if is_palo_fijo:
            if new_count <= old_count:
                return {'valid': False, 'reason': 'Must increase the count'}
            return {'valid': True, 'reason': ''}
        
        # Normal rules (non-Palo Fijo)
        
        # Special rules for 1s (aces)
        if old_value == 1 and new_value != 1:
            # Going FROM 1s to another number: need (old_count * 2) + 1
            min_count = (old_count * 2) + 1
            if new_count < min_count:
                return {
                    'valid': False,
                    'reason': f'Going from 1s requires at least {min_count} dice'
                }
            return {'valid': True, 'reason': ''}
        
        if old_value != 1 and new_value == 1:
            # Going TO 1s from another number: need (old_count // 2) + 1
            min_count = (old_count // 2) + 1
            if new_count < min_count:
                return {
                    'valid': False,
                    'reason': f'Going to 1s requires at least {min_count} dice'
                }
            return {'valid': True, 'reason': ''}
        
        # Same value - must increase count
        if new_value == old_value:
            if new_count <= old_count:
                return {'valid': False, 'reason': 'Must increase count for same value'}
            return {'valid': True, 'reason': ''}
        
        # Higher value - can keep same count or increase
        if new_value > old_value:
            if new_count < old_count:
                return {'valid': False, 'reason': 'Cannot decrease count when changing value'}
            return {'valid': True, 'reason': ''}
        
        # Lower value - must increase count
        if new_value < old_value:
            if new_count <= old_count:
                return {'valid': False, 'reason': 'Must increase count when going to lower value'}
            return {'valid': True, 'reason': ''}
        
        return {'valid': True, 'reason': ''}

    @staticmethod
    def count_dice(all_dice: list, value: int, wilds_count: bool = True) -> int:
        """
        Count how many dice match a value across all players
        
        Args:
            all_dice: List of lists of dice values
            value: The value to count
            wilds_count: Whether 1s count as wild (False during Palo Fijo)
        """
        count = 0
        for player_dice in all_dice:
            for die in player_dice:
                if die == value:
                    count += 1
                elif die == 1 and value != 1 and wilds_count:
                    # 1s are wild for non-1 values (unless Palo Fijo)
                    count += 1
        return count

    @staticmethod
    def is_bet_met(all_dice: list, bet: dict, wilds_count: bool = True) -> dict:
        """
        Check if a bet is met by the dice
        
        Args:
            all_dice: List of lists of dice values
            bet: The bet {count, value}
            wilds_count: Whether 1s count as wild (False during Palo Fijo)
        
        Returns:
            {met: bool, actualCount: int}
        """
        actual = BetValidator.count_dice(all_dice, bet['value'], wilds_count)
        return {
            'met': actual >= bet['count'],
            'actualCount': actual
        }

    @staticmethod
    def is_exact_match(all_dice: list, bet: dict, wilds_count: bool = True) -> bool:
        """
        Check if the dice exactly match the bet (for Calzo)
        
        Args:
            all_dice: List of lists of dice values
            bet: The bet {count, value}
            wilds_count: Whether 1s count as wild (False during Palo Fijo)
        """
        actual = BetValidator.count_dice(all_dice, bet['value'], wilds_count)
        return actual == bet['count']