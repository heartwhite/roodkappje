import React from 'react';
import './App.css';
import Renderer from './Renderer';
import Orders from './components/Orders';

function App() {
  return (
    <div className='App'>
      <header className='App-header'>Shopify Vendors Payout</header>
      {/* <Renderer /> */}
      <Orders />
    </div>
  );
}

export default App;
