import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import CabPoolLanding from './Pages/CabPoolLanding'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <CabPoolLanding />
    </>
  )
}

export default App
