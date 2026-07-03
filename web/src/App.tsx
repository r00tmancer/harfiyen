import { useStore } from './store';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Game from './screens/Game';
import Victory from './screens/Victory';
import Reactions from './ui/Reactions';

function ConnToast() {
  const conn = useStore((s) => s.conn);
  const screen = useStore((s) => s.screen);
  if (screen === 'home' || conn !== 'reconnecting') return null;
  return (
    <div className="toast" role="status">
      Bağlantı koptu, yeniden deneniyor...
    </div>
  );
}

export default function App() {
  const screen = useStore((s) => s.screen);
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4">
        {screen === 'home' && <Home />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'game' && <Game />}
        {screen === 'victory' && <Victory />}
      </main>
      {/* tepkiler: oda ekranlarinin tumunde (lobi, oyun, zafer) */}
      {screen !== 'home' && <Reactions />}
      <ConnToast />
    </>
  );
}
