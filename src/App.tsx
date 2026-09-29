import { Routes, Route } from 'react-router-dom'


function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={
        <>
          <h1 className="text-capilar-violet font-bold text-3xl p-8">
            ¡CapiLAR está listo para maquetar!
          </h1>
        </>
      } />


    </Routes>
  )
}

export default App