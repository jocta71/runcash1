import Head from 'next/head';
import RouletteHistory from '../components/RouletteHistory';

export default function HistoricoPage() {
  return (
    <div>
      <Head>
        <title>Histórico de Roletas | RunCash</title>
        <meta name="description" content="Histórico completo de números das roletas" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Histórico de Roletas</h1>
        <RouletteHistory />
      </main>

      <footer className="bg-gray-100 mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} RunCash. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
} 