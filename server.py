"""
Cachitos Game Server - Flask + SocketIO
"""
import os
import socket
import time
import threading
from flask import Flask, send_from_directory, request, jsonify
from flask_socketio import SocketIO, emit

from game.game import Game
from game.probability import generate_probability_table, get_quick_probabilities

# Initialize Flask app
app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'cachitos-secret-key')

# Try eventlet for production, fall back to threading for local dev
try:
    import eventlet
    eventlet.monkey_patch()
    async_mode = 'eventlet'
except (ImportError, Exception):
    async_mode = 'threading'

print(f'Using async mode: {async_mode}')

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)

# Single game instance
game = Game()

# Bot turn delay (seconds) - makes bot actions visible
BOT_TURN_DELAY = 1.5


def get_local_ips():
    """Get local network IP addresses"""
    addresses = []
    try:
        hostname = socket.gethostname()
        try:
            host_ips = socket.gethostbyname_ex(hostname)[2]
            for ip in host_ips:
                if not ip.startswith('127.'):
                    addresses.append(ip)
        except socket.gaierror:
            pass
        
        if not addresses:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(('8.8.8.8', 80))
                addresses.append(s.getsockname()[0])
            except Exception:
                pass
            finally:
                s.close()
    except Exception as e:
        print(f"Could not determine local IP: {e}")
    
    return addresses


def broadcast_game_state_to_all():
    """Broadcast game state to all connected players and spectators"""
    for player in game.players:
        if player.is_connected and not player.is_bot:
            socketio.emit('gameState', game.get_state_for_player(player.id), room=player.id)
    for spectator in game.spectators:
        if spectator.is_connected:
            socketio.emit('gameState', game.get_state_for_player(spectator.id), room=spectator.id)


def process_bot_turn():
    """Process bot turn if current player is a bot"""
    if not game.is_current_player_bot():
        return
    
    if game.state not in ['betting']:
        return
    
    # Add delay so humans can see what's happening
    time.sleep(BOT_TURN_DELAY)
    
    current_player = game.get_current_player()
    if not current_player or not current_player.is_bot:
        return
    
    decision = game.get_bot_decision()
    if not decision:
        return
    
    print(f"Bot {current_player.name} decides: {decision}")
    
    result = None
    if decision['action'] == 'bet':
        result = game.place_bet(current_player.id, {
            'count': decision['count'],
            'value': decision['value']
        })
        if result['success']:
            print(f"Bot bet: {decision['count']}x{decision['value']}s")
    elif decision['action'] == 'doubt':
        result = game.doubt(current_player.id)
        if result['success']:
            print(f"Bot doubted! Result: {result.get('result', {}).get('betMet', 'N/A')}")
            socketio.emit('roundResolved', result['result'])
    elif decision['action'] == 'calzo':
        result = game.calzo(current_player.id)
        if result['success']:
            print(f"Bot calzo! Result: {result.get('result', {}).get('isExact', 'N/A')}")
            socketio.emit('roundResolved', result['result'])
    
    # Broadcast updated state
    broadcast_game_state_to_all()
    
    # If game is in resolving state, wait then continue
    if game.state == 'resolving':
        time.sleep(BOT_TURN_DELAY * 2)
        game.continue_to_next_round()
        broadcast_game_state_to_all()
    
    # Check if next player is also a bot
    if game.is_current_player_bot() and game.state == 'betting':
        # Schedule next bot turn
        threading.Thread(target=process_bot_turn, daemon=True).start()


def schedule_bot_turn():
    """Schedule bot turn processing in background thread"""
    if game.is_current_player_bot() and game.state == 'betting':
        threading.Thread(target=process_bot_turn, daemon=True).start()


# Routes
@app.route('/')
def index():
    """Serve the main page"""
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    """Serve static files"""
    return send_from_directory('static', path)


@app.route('/api/ping')
def ping():
    """Keep-alive endpoint to prevent Render free tier from sleeping"""
    return 'pong'


@app.route('/api/probability')
def get_probability_table():
    """API endpoint for probability table"""
    total_dice = request.args.get('total_dice', type=int, default=10)
    dice_str = request.args.get('my_dice', default='')
    painted_str = request.args.get('painted_dice', default='')
    
    my_dice = None
    if dice_str:
        try:
            my_dice = [int(d) for d in dice_str.split(',') if d]
        except ValueError:
            pass
    
    # Add painted dice to known dice
    painted_dice = []
    if painted_str:
        try:
            painted_dice = [int(d) for d in painted_str.split(',') if d]
        except ValueError:
            pass
    
    if my_dice and painted_dice:
        my_dice = my_dice + painted_dice
    
    table = generate_probability_table(total_dice, my_dice)
    return jsonify(table)


# Socket.IO Event Handlers
@socketio.on('connect')
def handle_connect():
    """Handle new connection"""
    print(f"Player connected: {request.sid}")
    emit('gameState', game.get_state_for_player(request.sid))


@socketio.on('disconnect')
def handle_disconnect():
    """Handle disconnection"""
    result = game.remove_player(request.sid)
    
    if result['success']:
        player = result['player']
        print(f"Player disconnected: {player.name}")
        broadcast_game_state_to_all()
        socketio.emit('playerLeft', {
            'player': player.get_public_info(),
            'playerCount': len(game.players)
        })


@socketio.on('join')
def handle_join(data):
    """Handle player joining the game (as player or spectator)"""
    name = data.get('name', '')
    emoji = data.get('emoji', None)
    
    # Check if already in game (player or spectator)
    existing = game.get_player(request.sid)
    if existing:
        emit('joinResult', {'success': True, 'playerId': request.sid})
        broadcast_game_state_to_all()
        return
    
    # Try to join as player first
    result = game.add_player(request.sid, name, emoji)
    
    if result['success']:
        player = result['player']
        print(f"{player.emoji} {name} joined the game")
        emit('joinResult', {'success': True, 'playerId': request.sid})
        broadcast_game_state_to_all()
        socketio.emit('playerJoined', {
            'player': player.get_public_info(),
            'playerCount': len(game.players)
        })
    else:
        # If game in progress or full, join as spectator
        if game.state != 'waiting' or len(game.players) >= game.max_players:
            if not name or not name.strip():
                emit('joinResult', {'success': False, 'error': 'Name is required'})
                return
            from game.player import Player
            spectator = Player(request.sid, name.strip(), emoji)
            spectator.is_spectator = True
            game.spectators.append(spectator)
            print(f"{spectator.emoji} {name} joined as spectator")
            emit('joinResult', {'success': True, 'playerId': request.sid})
            broadcast_game_state_to_all()
        else:
            emit('joinResult', {'success': False, 'error': result['error']})


@socketio.on('addBot')
def handle_add_bot():
    """Handle adding a bot player"""
    if not game.is_host(request.sid):
        emit('error', {'message': 'Only the host can add bots'})
        return
    
    result = game.add_bot()
    
    if result['success']:
        player = result['player']
        print(f"Bot added: {player.name}")
        broadcast_game_state_to_all()
        socketio.emit('botAdded', {
            'player': player.get_public_info(),
            'playerCount': len(game.players)
        })
    else:
        emit('error', {'message': result['error']})


@socketio.on('removeBot')
def handle_remove_bot(data):
    """Handle removing a bot player"""
    if not game.is_host(request.sid):
        emit('error', {'message': 'Only the host can remove bots'})
        return
    
    bot_id = data.get('botId', '')
    result = game.remove_bot(bot_id)
    
    if result['success']:
        player = result['player']
        print(f"Bot removed: {player.name}")
        broadcast_game_state_to_all()
        socketio.emit('botRemoved', {
            'player': player.get_public_info(),
            'playerCount': len(game.players)
        })
    else:
        emit('error', {'message': result['error']})


@socketio.on('movePlayer')
def handle_move_player(data):
    """Handle host reordering a player"""
    if not game.is_host(request.sid):
        emit('error', {'message': 'Only the host can reorder players'})
        return
    
    player_id = data.get('playerId', '')
    direction = data.get('direction', '')
    
    result = game.move_player(player_id, direction)
    if result['success']:
        broadcast_game_state_to_all()
    else:
        emit('error', {'message': result['error']})


@socketio.on('shufflePlayers')
def handle_shuffle_players():
    """Handle host shuffling player order"""
    if not game.is_host(request.sid):
        emit('error', {'message': 'Only the host can shuffle players'})
        return
    
    result = game.shuffle_players()
    if result['success']:
        broadcast_game_state_to_all()
    else:
        emit('error', {'message': result['error']})


@socketio.on('startGame')
def handle_start_game():
    """Handle host starting the game"""
    result = game.start_game(request.sid)
    
    if result['success']:
        print('Game started!')
        broadcast_game_state_to_all()
        socketio.emit('gameStarted', {'roundNumber': game.round_number})
        
        # Check if first player is a bot
        schedule_bot_turn()
    else:
        emit('error', {'message': result['error']})


@socketio.on('stopGame')
def handle_stop_game():
    """Handle host stopping the game"""
    result = game.stop_game(request.sid)
    
    if result['success']:
        print('Game stopped by host')
        broadcast_game_state_to_all()
        socketio.emit('gameStopped', {})
    else:
        emit('error', {'message': result['error']})


@socketio.on('bet')
def handle_bet(data):
    """Handle player placing a bet"""
    count = data.get('count')
    value = data.get('value')
    paint_indices = data.get('paintIndices', None)
    
    result = game.place_bet(
        request.sid, 
        {'count': count, 'value': value},
        paint_indices
    )
    
    if result['success']:
        painted = result.get('painted', [])
        if painted:
            print(f"Bet placed: {count}x{value}s (painted: {painted})")
        else:
            print(f"Bet placed: {count}x{value}s")
        broadcast_game_state_to_all()
        
        # Check if next player is a bot
        schedule_bot_turn()
    else:
        emit('error', {'message': result['error']})


@socketio.on('doubt')
def handle_doubt():
    """Handle player calling doubt"""
    result = game.doubt(request.sid)
    
    if result['success']:
        print(f"Doubt called! Result: {result['result']}")
        broadcast_game_state_to_all()
        socketio.emit('roundResolved', result['result'])
    else:
        emit('error', {'message': result['error']})


@socketio.on('calzo')
def handle_calzo():
    """Handle player calling calzo"""
    result = game.calzo(request.sid)
    
    if result['success']:
        print(f"Calzo called! Result: {result['result']}")
        broadcast_game_state_to_all()
        socketio.emit('roundResolved', result['result'])
    else:
        emit('error', {'message': result['error']})


@socketio.on('nextRound')
def handle_next_round():
    """Handle continuing to next round"""
    result = game.continue_to_next_round()
    
    if result['success']:
        print('Starting next round')
        broadcast_game_state_to_all()
        socketio.emit('newRound', {'roundNumber': game.round_number})
        
        # Check if first player of new round is a bot
        schedule_bot_turn()
    else:
        emit('error', {'message': result['error']})


@socketio.on('resetGame')
def handle_reset_game():
    """Handle game reset (host only)"""
    if game.is_host(request.sid):
        game.reset()
        print('Game reset')
        broadcast_game_state_to_all()
        socketio.emit('gameReset', {})
    else:
        emit('error', {'message': 'Only the host can reset the game'})


@socketio.on('transferHost')
def handle_transfer_host(data):
    """Handle host transferring host role to another player"""
    target_id = data.get('targetId', '')
    result = game.transfer_host(request.sid, target_id)
    
    if result['success']:
        print(f"Host transferred to: {result['player'].name}")
        broadcast_game_state_to_all()
    else:
        emit('error', {'message': result['error']})


@socketio.on('kickPlayer')
def handle_kick_player(data):
    """Handle host kicking a player or spectator"""
    target_id = data.get('targetId', '')
    result = game.kick_player(request.sid, target_id)
    
    if result['success']:
        player = result['player']
        print(f"Kicked: {player.name}")
        # Notify the kicked player
        socketio.emit('kicked', {'reason': 'You were kicked by the host'}, room=target_id)
        broadcast_game_state_to_all()
    else:
        emit('error', {'message': result['error']})


@socketio.on('moveToSpectators')
def handle_move_to_spectators(data):
    """Handle host moving a player to spectator bench"""
    target_id = data.get('targetId', '')
    result = game.move_to_spectators(request.sid, target_id)
    
    if result['success']:
        player = result['player']
        print(f"Moved to spectators: {player.name}")
        broadcast_game_state_to_all()
    else:
        emit('error', {'message': result['error']})


@socketio.on('moveToPlayers')
def handle_move_to_players(data):
    """Handle host moving a spectator to game table"""
    target_id = data.get('targetId', '')
    result = game.move_to_players(request.sid, target_id)
    
    if result['success']:
        player = result['player']
        print(f"Moved to game table: {player.name}")
        broadcast_game_state_to_all()
    else:
        emit('error', {'message': result['error']})


@socketio.on('chatMessage')
def handle_chat_message(data):
    """Handle chat message from a player"""
    text = data.get('text', '').strip()
    if not text or len(text) > 100:
        return
    
    player = game.get_player(request.sid)
    if not player:
        return
    
    message = {
        'sender': player.name,
        'emoji': player.emoji,
        'text': text,
        'timestamp': time.time(),
        'isSpectator': player.is_spectator
    }
    
    # Store in chat history (keep last 50)
    if not hasattr(game, 'chat_messages'):
        game.chat_messages = []
    game.chat_messages.append(message)
    if len(game.chat_messages) > 50:
        game.chat_messages = game.chat_messages[-50:]
    
    # Broadcast to all connected players
    socketio.emit('chatMessage', message)


@socketio.on('requestState')
def handle_request_state():
    """Handle state request"""
    emit('gameState', game.get_state_for_player(request.sid))


@socketio.on('getProbabilities')
def handle_get_probabilities(data):
    """Handle probability calculation request"""
    bet_count = data.get('count', 1)
    bet_value = data.get('value', 6)
    
    player = game.get_player(request.sid)
    
    # During Palo Fijo, players with >1 die can't see their own dice
    if game.is_palo_fijo and player and player.dice_count > 1:
        my_dice = []
    else:
        my_dice = player.dice if player else []
    
    # Include painted dice in known dice
    all_painted = game.get_all_painted_dice()
    known_dice = my_dice + all_painted
    
    probs = get_quick_probabilities(
        game.get_total_dice_count(),
        known_dice,
        bet_count,
        bet_value
    )
    
    emit('probabilities', probs)


if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3000))
    
    print('\n========================================')
    print('   🎲 CACHITOS GAME SERVER RUNNING 🎲')
    print('========================================\n')
    
    print(f'Local:    http://localhost:{PORT}')
    
    ips = get_local_ips()
    if ips:
        print('\nNetwork:  Share these URLs with players:')
        for ip in ips:
            print(f'          http://{ip}:{PORT}')
    
    print('\n----------------------------------------')
    print('Players can join by opening the URL in their browser')
    print('----------------------------------------\n')
    
    # Run the server
    socketio.run(app, host='0.0.0.0', port=PORT, debug=False, allow_unsafe_werkzeug=True)