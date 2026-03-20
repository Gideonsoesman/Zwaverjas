// ════════════════════════════════════════════════
// ZWAVERJAS — Amsterdam Klaverjassen Game Logic
// ════════════════════════════════════════════════

// --- Card Constants ---
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['7','8','9','10','J','Q','K','A'];

// Trump suit: J (Jas) is highest, then 9 (Nel)
const TRUMP_ORD = ['J','9','A','10','K','Q','8','7'];
const TRUMP_PTS = {J:20,'9':14,A:11,'10':10,K:4,Q:3,'8':0,'7':0};

// Non-trump suit order
const NORMAL_ORD = ['A','10','K','Q','J','9','8','7'];
const NORMAL_PTS = {A:11,'10':10,K:4,Q:3,J:2,'9':0,'8':0,'7':0};

// Roem sequence order (standard rank order for sequences)
const ROEM_SEQ = ['7','8','9','10','J','Q','K','A'];

// --- Deck ---
function mkDeck() {
  const d = [];
  for (const s of SUITS)
    for (const r of RANKS)
      d.push({s, r});
  return d; // 32 cards
}

function shuffle(d) {
  const a = [...d];
  for (let i = a.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deal in 3-2-3 pattern
function deal() {
  const deck = shuffle(mkDeck());
  const hands = {};
  for (let i = 0; i < 4; i++) {
    // 3-2-3 deal pattern from deck positions
    hands[i] = deck.slice(i * 8, (i + 1) * 8);
  }
  return hands;
}

// --- Points ---
function cardPoints(card, trump) {
  return card.s === trump ? (TRUMP_PTS[card.r] || 0) : (NORMAL_PTS[card.r] || 0);
}

// --- Card Comparison ---
function beats(a, b, leadSuit, trump) {
  const at = a.s === trump, bt = b.s === trump;
  if (at && !bt) return true;
  if (!at && bt) return false;
  if (at && bt) return TRUMP_ORD.indexOf(a.r) < TRUMP_ORD.indexOf(b.r);
  const al = a.s === leadSuit, bl = b.s === leadSuit;
  if (al && !bl) return true;
  if (!al && bl) return false;
  if (!al && !bl) return false; // both off-suit, first played wins
  return NORMAL_ORD.indexOf(a.r) < NORMAL_ORD.indexOf(b.r);
}

function trickWinner(trick, trump) {
  const leadSuit = trick[0].card.s;
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (beats(trick[i].card, best.card, leadSuit, trump)) {
      best = trick[i];
    }
  }
  return best;
}

// --- Teams ---
function team(seat) { return seat % 2 === 0 ? '02' : '13'; }
function isPartner(seat1, seat2) { return team(seat1) === team(seat2); }

// --- Valid Cards (Amsterdam Rules) ---
// Amsterdam rules:
// 1. Must follow suit if possible.
// 2. When TRUMP is led: must overtrump if possible, ALWAYS (even if partner winning).
//    If can't overtrump, must still play a trump (undertrump).
// 3. When CAN'T follow suit:
//    a. If partner is winning with NON-trump: may play any card (Amsterdam exception).
//    b. If partner is winning with trump: may play any card EXCEPT undertrump
//       (lower trump), unless hand is entirely lower trumps.
//    c. If opponent is winning: must trump; if opponent winning with trump, must
//       overtrump if possible, else must still play a trump.
// 4. If can't follow and can't trump: play anything.
function validCards(hand, trick, trump, mySeat) {
  if (!trick || !trick.length) return [...hand];

  const leadSuit = trick[0].card.s;
  const follow = hand.filter(c => c.s === leadSuit);

  // 1. Must follow suit if possible
  if (follow.length) {
    if (leadSuit === trump) {
      // Trump was led — MUST overtrump if possible (even if partner winning)
      const currentWinner = trickWinner(trick, trump);
      const bestRank = TRUMP_ORD.indexOf(currentWinner.card.r);
      const over = follow.filter(c => TRUMP_ORD.indexOf(c.r) < bestRank);
      return over.length ? over : follow; // Must overtrump if can, else any trump
    }
    return follow; // Follow non-trump suit: any card of that suit
  }

  // 2. Can't follow suit
  const currentWinner = trickWinner(trick, trump);
  const partnerWinning = mySeat !== undefined && isPartner(currentWinner.seat, mySeat);

  // AMSTERDAM RULE: If partner is winning
  if (partnerWinning) {
    if (currentWinner.card.s === trump) {
      // Partner winning with trump — can play anything EXCEPT undertrump
      // (unless hand is entirely lower trumps + non-follow cards)
      const bestRank = TRUMP_ORD.indexOf(currentWinner.card.r);
      const myTrumps = hand.filter(c => c.s === trump);
      const higherTrumps = myTrumps.filter(c => TRUMP_ORD.indexOf(c.r) < bestRank);
      const lowerTrumps = myTrumps.filter(c => TRUMP_ORD.indexOf(c.r) > bestRank);
      const nonTrumps = hand.filter(c => c.s !== trump);

      if (nonTrumps.length === 0 && higherTrumps.length === 0) {
        // Hand is entirely lower trumps — must play one (forced undertrump)
        return lowerTrumps;
      }
      // Can play anything except lower trumps
      const allowed = hand.filter(c => {
        if (c.s !== trump) return true; // non-trump always OK
        return TRUMP_ORD.indexOf(c.r) < bestRank; // only higher trumps OK
      });
      return allowed.length ? allowed : [...hand]; // safety fallback
    }
    // Partner winning with non-trump — can play anything (Amsterdam exception)
    return [...hand];
  }

  // 3. Opponent winning — must trump if possible
  const trumps = hand.filter(c => c.s === trump);
  if (trumps.length) {
    // If there's already a trump on the table, must overtrump if possible
    if (currentWinner.card.s === trump) {
      const bestRank = TRUMP_ORD.indexOf(currentWinner.card.r);
      const over = trumps.filter(c => TRUMP_ORD.indexOf(c.r) < bestRank);
      if (over.length) return over; // Must overtrump
      // Can't overtrump — must still play a trump (undertroeven)
      return trumps;
    }
    return trumps; // Must trump in
  }

  // 4. Can't follow and can't trump — play anything
  return [...hand];
}

// --- Roem (Bonus Combinations) ---
// Roem is calculated from the 4 cards in a single trick.
// Points go to the team that wins the trick.
function calcRoem(trickCards, trump) {
  let roem = 0;

  // --- Sequences (same suit, consecutive ranks) ---
  const bySuit = {};
  for (const c of trickCards) {
    if (!bySuit[c.s]) bySuit[c.s] = [];
    bySuit[c.s].push(c.r);
  }

  for (const [suit, ranks] of Object.entries(bySuit)) {
    if (ranks.length < 3) continue;
    const indices = ranks.map(r => ROEM_SEQ.indexOf(r)).sort((a, b) => a - b);

    // Find longest consecutive run
    let maxRun = 1, curRun = 1;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === indices[i - 1] + 1) curRun++;
      else curRun = 1;
      maxRun = Math.max(maxRun, curRun);
    }

    if (maxRun >= 4) roem += 50;       // Four in a row
    else if (maxRun >= 3) roem += 20;   // Three in a row
  }

  // --- Four of a Kind ---
  const byRank = {};
  for (const c of trickCards) {
    byRank[c.r] = (byRank[c.r] || 0) + 1;
  }
  for (const [rank, count] of Object.entries(byRank)) {
    if (count === 4) {
      if (rank === 'J') roem += 200;
      else if (['10', 'Q', 'K', 'A'].includes(rank)) roem += 100;
      // 7, 8, 9 four-of-a-kind: no roem (only 10-A and J)
    }
  }

  // --- Stuk (King + Queen of trump in same trick) ---
  const hasTrumpK = trickCards.some(c => c.s === trump && c.r === 'K');
  const hasTrumpQ = trickCards.some(c => c.s === trump && c.r === 'Q');
  if (hasTrumpK && hasTrumpQ) roem += 20;

  return roem;
}

// --- End Round Scoring ---
function scoreRound(doneTricks, trump, bidder) {
  const pts = { '02': 0, '13': 0 };
  const roemPts = { '02': 0, '13': 0 };
  const trickCount = { '02': 0, '13': 0 };

  for (let i = 0; i < doneTricks.length; i++) {
    const t = doneTricks[i];
    const tm = team(t.winner);
    trickCount[tm]++;

    // Card points
    let tp = 0;
    for (const { card } of t.cards) tp += cardPoints(card, trump);
    // Last trick bonus: 10 points
    if (i === 7) tp += 10;
    pts[tm] += tp;

    // Roem for this trick
    const cards = t.cards.map(x => x.card);
    const roem = calcRoem(cards, trump);
    roemPts[tm] += roem;
  }

  const bidTeam = team(bidder);
  const oppTeam = bidTeam === '02' ? '13' : '02';

  // Total including roem
  const bidTotal = pts[bidTeam] + roemPts[bidTeam];
  const oppTotal = pts[oppTeam] + roemPts[oppTeam];

  // Check for Pit (all 8 tricks by one team)
  const isPit = trickCount[bidTeam] === 8 || trickCount[oppTeam] === 8;
  const pitTeam = trickCount[bidTeam] === 8 ? bidTeam : (trickCount[oppTeam] === 8 ? oppTeam : null);

  let result;
  const scores = { '02': 0, '13': 0 };

  if (isPit && pitTeam) {
    // Pit: 162 + all roem + 100 bonus
    const totalRoem = roemPts['02'] + roemPts['13'];
    scores[pitTeam] = 162 + totalRoem + 100;
    scores[pitTeam === '02' ? '13' : '02'] = 0;
    result = 'pit';
  } else if (bidTotal > oppTotal) {
    // Bidding team wins — both teams get their points (rounded to nearest 10)
    scores[bidTeam] = Math.round((pts[bidTeam] + roemPts[bidTeam]) / 10) * 10;
    scores[oppTeam] = Math.round((pts[oppTeam] + roemPts[oppTeam]) / 10) * 10;
    result = 'won';
  } else {
    // Nat! Bidding team gets 0, opponent gets 162 + ALL roem from both teams
    const totalRoem = roemPts['02'] + roemPts['13'];
    scores[oppTeam] = 162 + totalRoem;
    scores[bidTeam] = 0;
    result = 'nat';
  }

  return {
    result,      // 'won', 'nat', 'pit'
    cardPts: pts,
    roemPts,
    totalBid: bidTotal,
    totalOpp: oppTotal,
    scores,
    isPit,
    pitTeam,
    trickCount
  };
}

// --- Game State ---
function mkState(dealer, seats, prevScores) {
  return {
    phase: 'playing_bidding', // playing_bidding -> playing -> ended
    dealer,
    cur: (dealer + 1) % 4,
    hands: deal(),
    trump: null,
    bidder: null,
    bidPasses: 0,
    trick: [],
    doneTricks: [],
    trickNo: 0,
    scores: prevScores || { '02': 0, '13': 0 },
    roundPts: { '02': 0, '13': 0 },
    roundRoem: { '02': 0, '13': 0 },
    roundResult: null,
    seats,
    sessionScores: {},
    roundNumber: 1,     // Current round in the set of 4
    setNumber: 1,       // Which set of 4 rounds
  };
}

// --- Exports for Node.js testing ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUITS, RANKS, TRUMP_ORD, NORMAL_ORD, TRUMP_PTS, NORMAL_PTS, ROEM_SEQ,
    mkDeck, shuffle, deal, cardPoints, beats, trickWinner,
    team, isPartner, validCards, calcRoem, scoreRound, mkState
  };
}
