# 🎲 Cachitos

A multiplayer web-based implementation of the popular Peruvian dice game Cachitos (also known as Perudo or Liar's Dice).

## How to Play

### Setup
- 2-8 players can play
- Each player starts with 5 dice
- One player hosts the game, others join via URL

### Game Flow
1. All players roll their dice (hidden from others)
2. A random player starts the first round
3. Players take turns either:
   - **Raising the bet** - Claim there are X dice showing value Y across ALL players' dice
   - **Doubting (Dudo)** - Challenge the previous player's bet
   - **Calzo** - Claim the bet is exactly correct (to win back a die)

### Betting Rules
- When raising, you must increase either the count or the value
- **1s are wild** - They count as any other number
- **Going to 1s**: Minimum count is floor(previous_count/2) + 1
- **Going from 1s**: Minimum count is (previous_count × 2) + 1

### Winning/Losing
- If you **doubt** and the bet was NOT met → Previous bettor loses a die
- If you **doubt** and the bet WAS met → You lose a die
- If you **calzo** and it's exactly correct → You gain a die (max 5)
- If you **calzo** and it's NOT exact → You lose a die
- Last player with dice wins!

## Running the Game

### Prerequisites
- Python 3.7+ installed on your computer

### Installation

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Start the server:**
```bash
python server.py
```

The server will display:
- Local URL: `http://localhost:3000`
- Network URLs for other players to join (e.g., `http://192.168.1.100:3000`)

### Joining a Game
1. The host opens the local URL in their browser
2. Other players on the same WiFi network open the network URL
3. Everyone enters their name and joins
4. Host clicks "Start Game" when all players have joined

### Quick Start (One-liner)
```bash
pip install -r requirements.txt && python server.py
```

## Project Structure

```
cachitos/
├── server.py              # Flask + SocketIO server
├── requirements.txt       # Python dependencies
├── game/
│   ├── __init__.py
│   ├── game.py            # Main game logic
│   ├── player.py          # Player class
│   └── bet_validator.py   # Betting rules validation
├── static/
│   ├── index.html         # Web interface
│   ├── style.css          # Styles
│   └── client.js          # Client-side logic
└── README.md
```

## Features

- ✅ Real-time multiplayer via WebSockets
- ✅ Complete game logic with all betting rules
- ✅ Wild 1s implementation
- ✅ Calzo (exact match) betting
- ✅ Visual dice display with wild 1s highlighted
- ✅ Turn-based gameplay
- ✅ Round resolution with dice reveal
- ✅ Game over with winner announcement
- ✅ Play again functionality

## Game Rules Summary

### Betting Validation Table

| Action | Requirement |
|--------|-------------|
| **Same value** | New count > old count |
| **Higher value (2-6)** | New count ≥ old count |
| **Lower value (2-6)** | New count > old count |
| **To 1s** | New count ≥ floor(old_count/2) + 1 |
| **From 1s** | New count ≥ old_count × 2 + 1 |

### Examples
- From 5×⚄ you can go to: 6×⚄, 5×⚅, 6×⚁, or 3×⚀ (1s)
- From 3×⚀ (1s) you can go to: 4×⚀ or 7×(any other)

## Future Enhancements

- [ ] QR code for easy mobile joining
- [ ] AI players
- [ ] Sound effects
- [ ] Game statistics
- [ ] Multiple game rooms
- [ ] Reconnection handling

## Troubleshooting

### "Address already in use"
If port 3000 is busy, you can change it:
```bash
PORT=3001 python server.py
```
Or on Windows:
```bash
set PORT=3001 && python server.py
```

### Other players can't connect
- Make sure all players are on the same WiFi network
- Check if your firewall is blocking port 3000
- Try using the IP address shown in the terminal

## License

MIT