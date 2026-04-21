"""
Probability calculator for Cachitos
Calculates the probability that a bet (X dice of value Y) exists
"""
from math import comb, factorial
from typing import List, Dict, Tuple


def binomial_probability(n: int, k: int, p: float) -> float:
    """
    Calculate binomial probability P(X >= k) for n trials with probability p
    Returns probability of getting AT LEAST k successes
    """
    if k > n:
        return 0.0
    if k <= 0:
        return 1.0
    
    # P(X >= k) = 1 - P(X < k) = 1 - sum(P(X = i) for i in 0..k-1)
    prob_less_than_k = 0.0
    for i in range(k):
        # P(X = i) = C(n,i) * p^i * (1-p)^(n-i)
        prob_less_than_k += comb(n, i) * (p ** i) * ((1 - p) ** (n - i))
    
    return 1.0 - prob_less_than_k


def exact_probability(n: int, k: int, p: float) -> float:
    """
    Calculate exact binomial probability P(X = k) for n trials with probability p
    Returns probability of getting EXACTLY k successes
    """
    if k > n or k < 0:
        return 0.0
    
    # P(X = k) = C(n,k) * p^k * (1-p)^(n-k)
    return comb(n, k) * (p ** k) * ((1 - p) ** (n - k))


def get_die_probability(value: int) -> float:
    """
    Get probability of rolling a specific value (including wild 1s)
    - For values 2-6: probability = 2/6 (the value OR a 1)
    - For value 1: probability = 1/6 (only 1s count)
    """
    if value == 1:
        return 1/6  # Only 1s
    else:
        return 2/6  # The value OR wild 1


def calculate_bet_probability_unknown(
    total_dice: int,
    bet_count: int,
    bet_value: int
) -> Dict[str, float]:
    """
    Calculate probability of a bet without knowing any dice (opponent's view)
    
    Args:
        total_dice: Total dice in play
        bet_count: Number of dice bet
        bet_value: Value bet (1-6)
    
    Returns:
        Dict with 'at_least' and 'exact' probabilities
    """
    p = get_die_probability(bet_value)
    
    return {
        'at_least': binomial_probability(total_dice, bet_count, p),
        'exact': exact_probability(total_dice, bet_count, p)
    }


def calculate_bet_probability_known(
    total_dice: int,
    my_dice: List[int],
    bet_count: int,
    bet_value: int
) -> Dict[str, float]:
    """
    Calculate probability knowing your own dice (player's view)
    
    Args:
        total_dice: Total dice in play
        my_dice: List of your dice values
        bet_count: Number of dice bet
        bet_value: Value bet (1-6)
    
    Returns:
        Dict with 'at_least', 'exact', and 'known_count' info
    """
    # Count how many matching dice I have
    known_count = 0
    for die in my_dice:
        if die == bet_value:
            known_count += 1
        elif die == 1 and bet_value != 1:
            # Wild 1s count for non-1 values
            known_count += 1
    
    # Unknown dice are total minus my dice count
    unknown_dice = total_dice - len(my_dice)
    
    # I need (bet_count - known_count) more from unknown dice
    needed = bet_count - known_count
    
    if needed <= 0:
        # I already have enough!
        return {
            'at_least': 1.0,
            'exact': exact_probability(unknown_dice, 0, get_die_probability(bet_value)) if needed == 0 else 0.0,
            'known_count': known_count,
            'needed': 0
        }
    
    if needed > unknown_dice:
        # Impossible - not enough dice
        return {
            'at_least': 0.0,
            'exact': 0.0,
            'known_count': known_count,
            'needed': needed
        }
    
    p = get_die_probability(bet_value)
    
    return {
        'at_least': binomial_probability(unknown_dice, needed, p),
        'exact': exact_probability(unknown_dice, needed, p),
        'known_count': known_count,
        'needed': needed
    }


def generate_probability_table(
    total_dice: int,
    my_dice: List[int] = None,
    max_count: int = None
) -> Dict[str, List[Dict]]:
    """
    Generate a probability table for display
    
    Args:
        total_dice: Total dice in play
        my_dice: Player's dice (None for unknown view)
        max_count: Maximum count to calculate (defaults to total_dice)
    
    Returns:
        Dict with 'unknown' and optionally 'known' probability tables
    """
    if max_count is None:
        max_count = min(total_dice, 15)  # Limit for display
    
    result = {
        'unknown': [],
        'total_dice': total_dice
    }
    
    # Generate unknown probabilities
    for value in range(1, 7):
        value_probs = {
            'value': value,
            'probabilities': []
        }
        for count in range(1, max_count + 1):
            probs = calculate_bet_probability_unknown(total_dice, count, value)
            value_probs['probabilities'].append({
                'count': count,
                'at_least': round(probs['at_least'] * 100, 1),
                'exact': round(probs['exact'] * 100, 1)
            })
        result['unknown'].append(value_probs)
    
    # Generate known probabilities if dice provided
    if my_dice:
        result['known'] = []
        result['my_dice'] = my_dice
        
        for value in range(1, 7):
            value_probs = {
                'value': value,
                'probabilities': []
            }
            for count in range(1, max_count + 1):
                probs = calculate_bet_probability_known(total_dice, my_dice, count, value)
                value_probs['probabilities'].append({
                    'count': count,
                    'at_least': round(probs['at_least'] * 100, 1),
                    'exact': round(probs['exact'] * 100, 1),
                    'known_count': probs['known_count'],
                    'needed': probs.get('needed', 0)
                })
            result['known'].append(value_probs)
    
    return result


def get_quick_probabilities(
    total_dice: int,
    my_dice: List[int],
    bet_count: int,
    bet_value: int
) -> Dict:
    """
    Get quick probability summary for a specific bet
    Used for bot decision making and UI tooltips
    """
    unknown = calculate_bet_probability_unknown(total_dice, bet_count, bet_value)
    known = calculate_bet_probability_known(total_dice, my_dice, bet_count, bet_value)
    
    return {
        'bet': {'count': bet_count, 'value': bet_value},
        'total_dice': total_dice,
        'unknown': {
            'at_least': round(unknown['at_least'] * 100, 1),
            'exact': round(unknown['exact'] * 100, 1)
        },
        'known': {
            'at_least': round(known['at_least'] * 100, 1),
            'exact': round(known['exact'] * 100, 1),
            'known_count': known['known_count'],
            'needed': known.get('needed', 0)
        }
    }