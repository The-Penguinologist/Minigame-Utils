export interface SimulatorUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  roleColor: string;
}

export const SIMULATED_USERS: SimulatorUser[] = [
  {
    id: 'user_player_1',
    username: 'Player1',
    displayName: 'You (Player 1)',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    roleColor: '#5865F2',
  },
  {
    id: 'user_player_2',
    username: 'Player2',
    displayName: 'Friend (Player 2)',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    roleColor: '#57F287',
  },
  {
    id: 'user_player_3',
    username: 'Player3',
    displayName: 'Player 3',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    roleColor: '#EB459E',
  },
];

export const BOT_USER_PROFILE = {
  id: 'bot_e_counter_999',
  username: 'Arcade Bot',
  displayName: 'Arcade Bot',
  tag: 'ArcadeBot#0001',
  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  isBot: true,
};

