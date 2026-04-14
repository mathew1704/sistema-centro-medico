import EnrutadorApp from './routes/EnrutadorApp';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <EnrutadorApp />
    </AuthProvider>
  );
}

export default App;