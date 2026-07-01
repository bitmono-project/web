import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider } from './lib/auth'
import Home from './pages/Home'
import CrackmesList from './pages/CrackmesList'
import CrackmeDetail from './pages/CrackmeDetail'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Moderation from './pages/Moderation'
import Submissions from './pages/Submissions'
import Admin from './pages/Admin'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import FAQ from './pages/FAQ'
import Ranks from './pages/Ranks'
import Download from './pages/Download'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="crackmes" element={<CrackmesList />} />
            <Route path="challenge/:slug" element={<CrackmeDetail />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="user/:handle" element={<Profile />} />
            <Route path="upload" element={<Upload />} />
            <Route path="login" element={<Login />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="moderation" element={<Moderation />} />
            <Route path="admin" element={<Admin />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="ranks" element={<Ranks />} />
            <Route path="download" element={<Download />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
