"""
Main Game class for Cachitos
"""
import random
import uuid
from typing import Optional, List, Dict
from .player import Player
from .bet_validator import BetValidator
from .bot import BotPlayer, generate_bot_name


class GameState:
    """Game state constants"""
    WAITING = 'waiting'      # Waiting for players to join
    ROLLING = 'rolling'      # Dice are being rolled
    BETTING = 'betting'      # Players are making bets
    RESOLVING = 'resolving'  # Round is being resolved (doubt/calzo)
    GAME_OVER = 'game_over'  # Game has ended


class Game:
    def __init__(self):
        self.players: List[Player] = []
        self.spectators: List[Player] = []  # Spectators (can chat, can't play)
        self.bots: Dict[str, BotPlayer] = {}  # Bot AI instances by player_id
        self.state = GameState.WAITING
        self.current_player_index = 0
        self.current_bet = None  # {count, value, playerId, playerName}
        self.previous_bettor_index = None
        self.round_number = 0
        self.last_action = None
        self.revealed_dice = None
        self.round_starter_index = 0
        self.min_players = 2
        self.max_players = 8
        self.host_id = None  # Persistent host (first human player to join)
        
        # Palo Fijo state
        self.is_palo_fijo = False
        self.palo_fijo_value = None  # The locked value for this round
        self.palo_fijo_player = None  # Who triggered it
        
        # Action log
        self.action_log: List[Dict] = []
        
        # Round bet history (for bot inference)
        self.round_bet_history: List[Dict] = []

    def add_player(self, player_id: str, name: str, emoji: str = None) -> dict:
        """Add a player to the game"""
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Game already in progress'}
        if len(self.players) >= self.max_players:
            return {'success': False, 'error': 'Game is full'}
        if any(p.id == player_id for p in self.players):
            return {'success': False, 'error': 'Player already in game'}
        if not name or not name.strip():
            return {'success': False, 'error': 'Name is required'}

        player = Player(player_id, name.strip(), emoji)
        self.players.append(player)
        
        # Set as host if no host yet
        if self.host_id is None:
            self.host_id = player_id
        
        return {'success': True, 'player': player}

    def add_bot(self) -> dict:
        """Add a bot player to the game"""
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Game already in progress'}
        if len(self.players) >= self.max_players:
            return {'success': False, 'error': 'Game is full'}

        # Generate unique ID and name for bot
        bot_id = f"bot_{uuid.uuid4().hex[:8]}"
        used_names = [p.name for p in self.players]
        bot_emoji, bot_name = generate_bot_name(used_names)

        # Create player and bot AI (pass the emoji explicitly)
        player = Player(bot_id, bot_name, emoji=bot_emoji)
        player.is_bot = True
        self.players.append(player)

        bot_ai = BotPlayer(bot_id, bot_name)
        self.bots[bot_id] = bot_ai

        return {'success': True, 'player': player, 'bot': bot_ai}

    def remove_bot(self, bot_id: str) -> dict:
        """Remove a bot from the game"""
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Cannot remove bots during game'}

        player = self.get_player(bot_id)
        if not player or not getattr(player, 'is_bot', False):
            return {'success': False, 'error': 'Bot not found'}

        self.players = [p for p in self.players if p.id != bot_id]
        if bot_id in self.bots:
            del self.bots[bot_id]

        return {'success': True, 'player': player}

    def remove_player(self, player_id: str) -> dict:
        """Remove a player from the game"""
        player = self.get_player(player_id)
        if not player:
            return {'success': False}

        # Check if spectator
        if player.is_spectator:
            self.spectators = [p for p in self.spectators if p.id != player_id]
            return {'success': True, 'player': player}

        if self.state == GameState.WAITING:
            # Remove completely if game hasn't started
            self.players = [p for p in self.players if p.id != player_id]
            if player_id in self.bots:
                del self.bots[player_id]
        else:
            # Mark as disconnected if game in progress
            player.is_connected = False
            player.dice_count = 0  # Eliminate from game

        # Transfer host if needed
        self._ensure_host()

        # Check if game should end
        self.check_game_over()

        return {'success': True, 'player': player}

    def reconnect_player(self, old_id: str, new_id: str) -> dict:
        """Reconnect a player with new socket ID"""
        player = self.get_player(old_id)
        if player:
            player.id = new_id
            player.is_connected = True
            return {'success': True, 'player': player}
        return {'success': False}

    def get_player(self, player_id: str) -> Optional[Player]:
        """Get a player by ID (searches players and spectators)"""
        for player in self.players:
            if player.id == player_id:
                return player
        for player in self.spectators:
            if player.id == player_id:
                return player
        return None

    def kick_player(self, host_id: str, target_id: str) -> dict:
        """Kick a player or spectator (host only, lobby only)"""
        if not self.is_host(host_id):
            return {'success': False, 'error': 'Only the host can kick players'}
        if host_id == target_id:
            return {'success': False, 'error': 'Cannot kick yourself'}
        
        # Search in players
        target = None
        for p in self.players:
            if p.id == target_id:
                target = p
                self.players = [x for x in self.players if x.id != target_id]
                if target_id in self.bots:
                    del self.bots[target_id]
                break
        
        # Search in spectators
        if not target:
            for p in self.spectators:
                if p.id == target_id:
                    target = p
                    self.spectators = [x for x in self.spectators if x.id != target_id]
                    break
        
        if not target:
            return {'success': False, 'error': 'Player not found'}
        
        return {'success': True, 'player': target}

    def move_to_spectators(self, host_id: str, target_id: str) -> dict:
        """Move a player from game table to spectator bench (host only, lobby only)"""
        if not self.is_host(host_id):
            return {'success': False, 'error': 'Only the host can move players'}
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Can only move players in lobby'}
        if host_id == target_id:
            return {'success': False, 'error': 'Cannot move yourself to spectators'}
        
        target = None
        for p in self.players:
            if p.id == target_id:
                target = p
                break
        
        if not target:
            return {'success': False, 'error': 'Player not found in game table'}
        
        self.players = [x for x in self.players if x.id != target_id]
        if target_id in self.bots:
            del self.bots[target_id]
        target.is_spectator = True
        self.spectators.append(target)
        
        return {'success': True, 'player': target}

    def move_to_players(self, host_id: str, target_id: str) -> dict:
        """Move a spectator from bench to game table (host only, lobby only)"""
        if not self.is_host(host_id):
            return {'success': False, 'error': 'Only the host can move players'}
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Can only move players in lobby'}
        if len(self.players) >= self.max_players:
            return {'success': False, 'error': 'Game table is full'}
        
        target = None
        for p in self.spectators:
            if p.id == target_id:
                target = p
                break
        
        if not target:
            return {'success': False, 'error': 'Spectator not found'}
        
        self.spectators = [x for x in self.spectators if x.id != target_id]
        target.is_spectator = False
        target.reset_for_new_game()
        self.players.append(target)
        
        return {'success': True, 'player': target}

    def move_player(self, player_id: str, direction: str) -> dict:
        """Move a player up or down in the order (lobby only)"""
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Can only reorder in lobby'}
        
        idx = next((i for i, p in enumerate(self.players) if p.id == player_id), None)
        if idx is None:
            return {'success': False, 'error': 'Player not found'}
        
        if direction == 'up' and idx > 0:
            self.players[idx], self.players[idx - 1] = self.players[idx - 1], self.players[idx]
        elif direction == 'down' and idx < len(self.players) - 1:
            self.players[idx], self.players[idx + 1] = self.players[idx + 1], self.players[idx]
        else:
            return {'success': False, 'error': 'Cannot move further'}
        
        return {'success': True}

    def shuffle_players(self) -> dict:
        """Shuffle player order randomly (lobby only)"""
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Can only shuffle in lobby'}
        
        random.shuffle(self.players)
        return {'success': True}

    def is_host(self, player_id: str) -> bool:
        """Check if a player is the host (persistent, not position-based)"""
        return self.host_id is not None and self.host_id == player_id

    def _ensure_host(self):
        """Ensure there's a valid host. Transfer if current host left."""
        # Check if current host is still in players
        if self.host_id:
            for p in self.players:
                if p.id == self.host_id and not p.is_bot:
                    return  # Host still present
        # Transfer to first non-bot player
        for p in self.players:
            if not p.is_bot and p.is_connected:
                self.host_id = p.id
                return
        self.host_id = None

    def transfer_host(self, host_id: str, target_id: str) -> dict:
        """Transfer host to another player (host only)"""
        if not self.is_host(host_id):
            return {'success': False, 'error': 'Only the host can transfer host'}
        if host_id == target_id:
            return {'success': False, 'error': 'You are already the host'}
        # Target must be a non-bot player
        target = None
        for p in self.players:
            if p.id == target_id and not p.is_bot:
                target = p
                break
        if not target:
            return {'success': False, 'error': 'Player not found'}
        self.host_id = target_id
        return {'success': True, 'player': target}

    def stop_game(self, host_id: str) -> dict:
        """Stop the game and return to lobby (host only)"""
        if not self.is_host(host_id):
            return {'success': False, 'error': 'Only the host can stop the game'}
        
        if self.state == GameState.WAITING:
            return {'success': False, 'error': 'Game has not started'}

        # Reset to waiting state but keep players
        self.state = GameState.WAITING
        self.current_player_index = 0
        self.current_bet = None
        self.previous_bettor_index = None
        self.round_number = 0
        self.last_action = None
        self.revealed_dice = None
        self.round_starter_index = 0
        self.is_palo_fijo = False
        self.palo_fijo_value = None
        self.palo_fijo_player = None
        self.action_log = []
        self.round_bet_history = []

        # Reset player state for new game
        for player in self.players:
            player.reset_for_new_game()

        return {'success': True}

    def start_game(self, host_id: str) -> dict:
        """Start the game"""
        if not self.is_host(host_id):
            return {'success': False, 'error': 'Only the host can start the game'}
        if len(self.players) < self.min_players:
            return {'success': False, 'error': f'Need at least {self.min_players} players'}
        if self.state != GameState.WAITING:
            return {'success': False, 'error': 'Game already started'}

        # Clear action log for new game
        self.action_log = []
        
        self.start_new_round(first_round=True)
        return {'success': True}

    def start_new_round(self, first_round: bool = False):
        """Start a new round"""
        self.round_number += 1
        self.current_bet = None
        self.previous_bettor_index = None
        self.last_action = None
        self.revealed_dice = None
        self.round_bet_history = []
        
        # Reset round state for all players
        for player in self.players:
            player.reset_round_state()

        # Determine who starts
        if first_round:
            # Random starter for first round
            alive_players = self.get_alive_players()
            random_player = random.choice(alive_players)
            self.round_starter_index = self.players.index(random_player)

        self.current_player_index = self.round_starter_index
        starter = self.players[self.round_starter_index]
        
        # Check for Palo Fijo
        # Triggers when starter has 1 die AND hasn't triggered before
        if starter.dice_count == 1 and not starter.has_triggered_palo_fijo:
            starter.has_triggered_palo_fijo = True
            self.is_palo_fijo = True
            self.palo_fijo_value = None  # Will be set by first bet
            self.palo_fijo_player = starter.name
            
            self._log_action({
                'type': 'palo_fijo_start',
                'player': starter.name,
                'round': self.round_number
            })
        else:
            self.is_palo_fijo = False
            self.palo_fijo_value = None
            self.palo_fijo_player = None

        # Roll dice for all alive players
        self.state = GameState.ROLLING
        for player in self.players:
            if player.is_alive():
                player.roll_dice()

        # Move to betting phase
        self.state = GameState.BETTING

    def get_alive_players(self) -> List[Player]:
        """Get all players still alive"""
        return [p for p in self.players if p.is_alive()]

    def get_total_dice_count(self) -> int:
        """Get total dice count across all alive players"""
        return sum(p.dice_count for p in self.players if p.is_alive())

    def get_current_player(self) -> Optional[Player]:
        """Get the current player"""
        if 0 <= self.current_player_index < len(self.players):
            return self.players[self.current_player_index]
        return None

    def is_current_player_bot(self) -> bool:
        """Check if current player is a bot"""
        current = self.get_current_player()
        return current and getattr(current, 'is_bot', False)

    def get_all_painted_dice(self) -> List[int]:
        """Get all painted dice values from all players"""
        painted = []
        for player in self.players:
            if player.is_alive():
                painted.extend(player.get_painted_dice_values())
        return painted

    def get_bot_decision(self) -> Optional[Dict]:
        """Get the bot's decision if current player is a bot"""
        current = self.get_current_player()
        if not current or not getattr(current, 'is_bot', False):
            return None

        bot_ai = self.bots.get(current.id)
        if not bot_ai:
            return None

        players_info = [p.get_public_info() for p in self.players]
        alive_count = len(self.get_alive_players())
        
        # During Palo Fijo, bots with >1 die can't see their dice (play blind)
        bot_dice = current.dice
        if self.is_palo_fijo and current.dice_count > 1:
            bot_dice = []  # Bot plays blind
        
        decision = bot_ai.decide_action(
            my_dice=bot_dice,
            total_dice=self.get_total_dice_count(),
            current_bet=self.current_bet,
            players_info=players_info,
            is_palo_fijo=self.is_palo_fijo,
            palo_fijo_value=self.palo_fijo_value,
            round_bet_history=self.round_bet_history,
            painted_dice=self.get_all_painted_dice(),
            alive_players=alive_count
        )

        return decision

    def next_turn(self):
        """Move to the next player's turn"""
        alive_players = self.get_alive_players()
        if len(alive_players) <= 1:
            return

        attempts = 0
        while attempts < len(self.players):
            self.current_player_index = (self.current_player_index + 1) % len(self.players)
            if self.players[self.current_player_index].is_alive():
                break
            attempts += 1

    def _log_action(self, action: Dict):
        """Add an action to the log"""
        action['timestamp'] = self.round_number
        self.action_log.append(action)

    def place_bet(self, player_id: str, bet: dict, paint_indices: list = None) -> dict:
        """Place a bet (raise), optionally with painted dice"""
        if self.state != GameState.BETTING:
            return {'success': False, 'error': 'Not in betting phase'}

        current_player = self.get_current_player()
        if not current_player or current_player.id != player_id:
            return {'success': False, 'error': 'Not your turn'}

        bet_count = int(bet['count'])
        bet_value = int(bet['value'])

        # Validate the bet
        validation = BetValidator.validate_bet(
            self.current_bet,
            {'count': bet_count, 'value': bet_value},
            self.get_total_dice_count(),
            self.is_palo_fijo,
            self.palo_fijo_value
        )

        if not validation['valid']:
            return {'success': False, 'error': validation['reason']}

        # Handle painting (if requested and allowed)
        painted_values = []
        if paint_indices and not self.is_palo_fijo:
            if current_player.has_painted_this_round:
                return {'success': False, 'error': 'Already painted this round'}
            
            # Validate paint - can only paint dice matching bet value or 1s (wilds)
            for idx in paint_indices:
                if idx < len(current_player.dice):
                    die_value = current_player.dice[idx]
                    if die_value != bet_value and die_value != 1:
                        return {
                            'success': False, 
                            'error': f'Can only paint {bet_value}s or 1s (wilds)'
                        }
            
            current_player.paint_dice(paint_indices)
            painted_values = current_player.get_painted_dice_values()

        # Set Palo Fijo value if this is the first bet
        if self.is_palo_fijo and self.palo_fijo_value is None:
            self.palo_fijo_value = bet_value

        # Accept the bet
        self.previous_bettor_index = self.current_player_index
        self.current_bet = {
            'count': bet_count,
            'value': bet_value,
            'playerId': player_id,
            'playerName': current_player.name
        }
        
        # Track player's last bet and round history
        current_player.last_bet = {'count': bet_count, 'value': bet_value}
        self.round_bet_history.append({
            'playerId': player_id,
            'playerName': current_player.name,
            'bet': {'count': bet_count, 'value': bet_value},
            'painted': painted_values
        })
        
        # Log the action
        self._log_action({
            'type': 'bet',
            'player': current_player.name,
            'emoji': current_player.emoji,
            'bet': {'count': bet_count, 'value': bet_value},
            'painted': painted_values if painted_values else None,
            'round': self.round_number
        })

        self.last_action = {
            'type': 'bet',
            'player': current_player.name,
            'bet': self.current_bet,
            'painted': painted_values
        }

        # Move to next player
        self.next_turn()

        return {'success': True, 'painted': painted_values}

    def doubt(self, player_id: str) -> dict:
        """Doubt the current bet (Dudo)"""
        if self.state != GameState.BETTING:
            return {'success': False, 'error': 'Not in betting phase'}

        current_player = self.get_current_player()
        if not current_player or current_player.id != player_id:
            return {'success': False, 'error': 'Not your turn'}

        if not self.current_bet:
            return {'success': False, 'error': 'No bet to doubt'}

        self.state = GameState.RESOLVING

        # Collect all dice
        all_dice = [
            {
                'playerId': p.id,
                'playerName': p.name,
                'emoji': p.emoji,
                'dice': p.dice,
                'paintedIndices': p.painted_dice
            }
            for p in self.players if p.is_alive()
        ]
        self.revealed_dice = all_dice

        # Check if bet is met (1s are NOT wild during Palo Fijo)
        all_dice_arrays = [d['dice'] for d in all_dice]
        result = BetValidator.is_bet_met(
            all_dice_arrays, 
            self.current_bet, 
            wilds_count=not self.is_palo_fijo
        )

        # Determine loser
        previous_bettor = self.players[self.previous_bettor_index]

        if result['met']:
            # Bet was met - doubter loses
            loser = current_player
            winner = previous_bettor
        else:
            # Bet was not met - bettor loses
            loser = previous_bettor
            winner = current_player

        loser.lose_die()

        resolution = {
            'type': 'doubt',
            'doubter': current_player.name,
            'doubterEmoji': current_player.emoji,
            'bettor': previous_bettor.name,
            'bettorEmoji': previous_bettor.emoji,
            'bet': self.current_bet,
            'actualCount': result['actualCount'],
            'betMet': result['met'],
            'loser': loser.name,
            'loserDiceRemaining': loser.dice_count,
            'allDice': all_dice,
            'isPaloFijo': self.is_palo_fijo
        }

        self._log_action({
            'type': 'doubt',
            'doubter': current_player.name,
            'bettor': previous_bettor.name,
            'bet': self.current_bet,
            'actualCount': result['actualCount'],
            'success': not result['met'],
            'loser': loser.name,
            'round': self.round_number
        })

        self.last_action = resolution

        # Check for game over
        if self.check_game_over():
            return {'success': True, 'result': resolution}

        # Loser starts next round (if still alive), otherwise winner starts
        if loser.is_alive():
            self.round_starter_index = self.players.index(loser)
        else:
            self.round_starter_index = self.players.index(winner)

        return {'success': True, 'result': resolution}

    def calzo(self, player_id: str) -> dict:
        """Calzo - claim exact match"""
        if self.state != GameState.BETTING:
            return {'success': False, 'error': 'Not in betting phase'}

        current_player = self.get_current_player()
        if not current_player or current_player.id != player_id:
            return {'success': False, 'error': 'Not your turn'}

        if not self.current_bet:
            return {'success': False, 'error': 'No bet to calzo'}

        self.state = GameState.RESOLVING

        # Collect all dice
        all_dice = [
            {
                'playerId': p.id,
                'playerName': p.name,
                'emoji': p.emoji,
                'dice': p.dice,
                'paintedIndices': p.painted_dice
            }
            for p in self.players if p.is_alive()
        ]
        self.revealed_dice = all_dice

        # Check for exact match (1s are NOT wild during Palo Fijo)
        all_dice_arrays = [d['dice'] for d in all_dice]
        is_exact = BetValidator.is_exact_match(
            all_dice_arrays, 
            self.current_bet,
            wilds_count=not self.is_palo_fijo
        )
        actual_count = BetValidator.count_dice(
            all_dice_arrays, 
            self.current_bet['value'],
            wilds_count=not self.is_palo_fijo
        )

        if is_exact:
            # Calzo successful - player gains a die
            current_player.gain_die()
            outcome = 'success'
        else:
            # Calzo failed - player loses a die
            current_player.lose_die()
            outcome = 'fail'

        resolution = {
            'type': 'calzo',
            'caller': current_player.name,
            'callerEmoji': current_player.emoji,
            'bet': self.current_bet,
            'actualCount': actual_count,
            'isExact': is_exact,
            'outcome': outcome,
            'callerDiceRemaining': current_player.dice_count,
            'allDice': all_dice,
            'isPaloFijo': self.is_palo_fijo
        }

        self._log_action({
            'type': 'calzo',
            'caller': current_player.name,
            'bet': self.current_bet,
            'actualCount': actual_count,
            'success': is_exact,
            'round': self.round_number
        })

        self.last_action = resolution

        # Check for game over
        if self.check_game_over():
            return {'success': True, 'result': resolution}

        # Calzo caller starts next round
        self.round_starter_index = self.players.index(current_player)
        if not current_player.is_alive():
            # If caller is eliminated, next alive player starts
            self.round_starter_index = self.get_next_alive_player_index(self.current_player_index)

        return {'success': True, 'result': resolution}

    def get_next_alive_player_index(self, from_index: int) -> int:
        """Get next alive player index from given index"""
        index = from_index
        for _ in range(len(self.players)):
            index = (index + 1) % len(self.players)
            if self.players[index].is_alive():
                return index
        return from_index

    def continue_to_next_round(self) -> dict:
        """Continue to next round after resolution"""
        if self.state != GameState.RESOLVING:
            return {'success': False, 'error': 'Not in resolving phase'}

        if self.state == GameState.GAME_OVER:
            return {'success': False, 'error': 'Game is over'}

        self.start_new_round()
        return {'success': True}

    def check_game_over(self) -> bool:
        """Check if game is over"""
        alive_players = self.get_alive_players()
        if len(alive_players) <= 1:
            self.state = GameState.GAME_OVER
            if alive_players:
                self._log_action({
                    'type': 'game_over',
                    'winner': alive_players[0].name,
                    'round': self.round_number
                })
            return True
        return False

    def get_winner(self) -> Optional[Player]:
        """Get the winner (if game is over)"""
        if self.state != GameState.GAME_OVER:
            return None
        alive_players = self.get_alive_players()
        return alive_players[0] if len(alive_players) == 1 else None

    def reset(self):
        """Reset the game to waiting state"""
        for player in self.players:
            player.reset_for_new_game()
        self.state = GameState.WAITING
        self.current_player_index = 0
        self.current_bet = None
        self.previous_bettor_index = None
        self.round_number = 0
        self.last_action = None
        self.revealed_dice = None
        self.round_starter_index = 0
        self.is_palo_fijo = False
        self.palo_fijo_value = None
        self.palo_fijo_player = None
        self.action_log = []
        self.round_bet_history = []

    def _are_dice_hidden(self, player: Optional[Player]) -> bool:
        """Check if a player's dice should be hidden (Palo Fijo rule)"""
        if not player or not player.is_alive():
            return False
        if not self.is_palo_fijo:
            return False
        if self.state not in [GameState.BETTING, GameState.ROLLING]:
            return False
        # During Palo Fijo: only the triggering player and players with 1 die can see
        if player.dice_count == 1:
            return False
        return True

    def _get_visible_dice(self, player: Optional[Player]) -> list:
        """Get dice visible to this player (hidden during Palo Fijo for players with >1 die)"""
        if not player:
            return []
        if self._are_dice_hidden(player):
            return []  # Empty list signals hidden
        return player.dice

    def get_state_for_player(self, player_id: str) -> dict:
        """Get game state for a specific player"""
        player = self.get_player(player_id)
        current_player = self.get_current_player()
        winner = self.get_winner()

        return {
            'state': self.state,
            'roundNumber': self.round_number,
            'players': [p.get_public_info() for p in self.players],
            'currentPlayerId': current_player.id if current_player else None,
            'currentPlayerName': current_player.name if current_player else None,
            'isMyTurn': current_player and current_player.id == player_id,
            'currentBet': self.current_bet,
            'totalDice': self.get_total_dice_count(),
            'myDice': self._get_visible_dice(player),
            'myDiceCount': player.dice_count if player else 0,
            'diceHidden': self._are_dice_hidden(player),
            'lastAction': self.last_action,
            'revealedDice': self.revealed_dice,
            'winner': winner.get_public_info() if winner else None,
            'hostId': self.host_id,
            'isHost': self.is_host(player_id),
            'canStart': (
                self.is_host(player_id) and
                self.state == GameState.WAITING and
                len(self.players) >= self.min_players
            ),
            'canStop': self.is_host(player_id) and self.state not in [GameState.WAITING, GameState.GAME_OVER],
            'isCurrentPlayerBot': self.is_current_player_bot(),
            # Palo Fijo state
            'isPaloFijo': self.is_palo_fijo,
            'paloFijoValue': self.palo_fijo_value,
            'paloFijoPlayer': self.palo_fijo_player,
            # Paint state
            'canPaint': (
                player and 
                not player.has_painted_this_round and 
                not self.is_palo_fijo and
                current_player and 
                current_player.id == player_id
            ),
            'hasPaintedThisRound': player.has_painted_this_round if player else False,
            'allPaintedDice': self.get_all_painted_dice(),
            # Action log
            'actionLog': self.action_log,
            # Spectators
            'spectators': [p.get_public_info() for p in self.spectators],
            'isSpectator': player.is_spectator if player else False
        }

    def get_public_state(self) -> dict:
        """Get full public game state"""
        current_player = self.get_current_player()
        winner = self.get_winner()

        return {
            'state': self.state,
            'roundNumber': self.round_number,
            'players': [p.get_public_info() for p in self.players],
            'currentPlayerId': current_player.id if current_player else None,
            'currentPlayerName': current_player.name if current_player else None,
            'currentBet': self.current_bet,
            'totalDice': self.get_total_dice_count(),
            'lastAction': self.last_action,
            'revealedDice': self.revealed_dice,
            'winner': winner.get_public_info() if winner else None,
            'isPaloFijo': self.is_palo_fijo,
            'paloFijoValue': self.palo_fijo_value,
            'paloFijoPlayer': self.palo_fijo_player,
            'actionLog': self.action_log
        }