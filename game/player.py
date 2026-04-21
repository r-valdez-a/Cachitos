"""
Player class representing a player in the Cachitos game
"""
import random

# Available emoji icons for players
PLAYER_EMOJIS = [
    '😀', '😎', '🤠', '🥳', '😈', '👻', '💀', '🤖',
    '🐶', '🐱', '🦁', '🐯', '🦊', '🐺', '🐸', '🐵',
    '🐧', '🐻', '🦄', '🐲', '⭐', '🌙', '🔥', '💎',
    '🎯', '🎲', '🎮', '🏆', '⚡', '❄️'
]


class Player:
    def __init__(self, player_id: str, name: str, emoji: str = None):
        self.id = player_id
        self.name = name
        self.emoji = emoji or random.choice(PLAYER_EMOJIS)
        self.dice_count = 5  # Start with 5 dice (5 lives)
        self.dice = []  # Current dice values (hidden from others)
        self.is_connected = True
        self.is_bot = False  # Whether this player is a bot
        
        # Palo Fijo tracking
        self.has_triggered_palo_fijo = False  # Only triggers once per game
        
        # Round-specific state
        self.last_bet = None  # Last bet made this round {count, value}
        self.painted_dice = []  # Dice revealed this round (indices)
        self.has_painted_this_round = False

    def roll_dice(self) -> list:
        """Roll all dice for this player"""
        self.dice = [random.randint(1, 6) for _ in range(self.dice_count)]
        return self.dice

    def lose_die(self) -> int:
        """Remove one die (lose a life)"""
        if self.dice_count > 0:
            self.dice_count -= 1
        return self.dice_count

    def gain_die(self) -> int:
        """Add one die (win a calzo, max 5)"""
        if self.dice_count < 5:
            self.dice_count += 1
        return self.dice_count

    def is_alive(self) -> bool:
        """Check if player is still in the game"""
        return self.dice_count > 0

    def reset_round_state(self):
        """Reset state at the start of a new round"""
        self.last_bet = None
        self.painted_dice = []
        self.has_painted_this_round = False

    def reset_for_new_game(self):
        """Reset all state for a new game"""
        self.dice_count = 5
        self.dice = []
        self.has_triggered_palo_fijo = False
        self.last_bet = None
        self.painted_dice = []
        self.has_painted_this_round = False

    def paint_dice(self, dice_indices: list) -> bool:
        """
        Paint (reveal) selected dice.
        Non-painted dice are rerolled.
        Returns True if successful, False if already painted this round.
        """
        if self.has_painted_this_round:
            return False
        self.painted_dice = dice_indices
        self.has_painted_this_round = True
        
        # Reroll all non-painted dice
        for i in range(len(self.dice)):
            if i not in dice_indices:
                self.dice[i] = random.randint(1, 6)
        
        return True

    def get_painted_dice_values(self) -> list:
        """Get the values of painted dice"""
        return [self.dice[i] for i in self.painted_dice if i < len(self.dice)]

    def get_public_info(self) -> dict:
        """Get public info (visible to all players)"""
        return {
            'id': self.id,
            'name': self.name,
            'emoji': self.emoji,
            'diceCount': self.dice_count,
            'isConnected': self.is_connected,
            'isAlive': self.is_alive(),
            'isBot': self.is_bot,
            'lastBet': self.last_bet,
            'paintedDice': self.get_painted_dice_values(),
            'hasPaintedThisRound': self.has_painted_this_round
        }

    def get_private_info(self) -> dict:
        """Get private info (only visible to this player)"""
        info = self.get_public_info()
        info['dice'] = self.dice
        return info

    def to_dict(self) -> dict:
        """Serialize for JSON"""
        return self.get_public_info()