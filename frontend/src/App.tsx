import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { Navigation } from './components/Navigation'
import { HomePage } from './pages/HomePage'
import { DatasetsPage } from './pages/DatasetsPage'
import { DatasetDetailPage } from './pages/DatasetDetailPage'
import '@mysten/dapp-kit/dist/index.css'
import './App.css'

const queryClient = new QueryClient()
const networks = {
  testnet: { url: getFullnodeUrl('testnet') },
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <BrowserRouter>
            <div className="app-shell">
              <Navigation />
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/datasets" element={<DatasetsPage />} />
                <Route path="/datasets/:id" element={<DatasetDetailPage />} />
              </Routes>
            </div>
          </BrowserRouter>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}

export default App
