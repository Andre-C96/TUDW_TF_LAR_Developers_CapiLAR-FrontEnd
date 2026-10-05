import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/layout'
import { Home } from './pages/home/home'
import { NotFound } from './pages/notFound/notFound'

function App() {
  return (
    <Routes>
      {/* Páginas públicas con header y footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
