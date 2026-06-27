import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider } from './lib/auth'
import Home from './pages/Home'
import CrackmesList from './pages/CrackmesList'
import CrackmeDetail from './pages/CrackmeDetail'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Moderation from './pages/Moderation'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="crackmes" element={<CrackmesList />} />
            <Route path="challenge/:slug" element={<CrackmeDetail />} />
            <Route path="upload" element={<Upload />} />
            <Route path="login" element={<Login />} />
            <Route path="moderation" element={<Moderation />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
