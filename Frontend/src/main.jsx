import './index.css'
import App from './App.jsx'
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./modules/cart";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <CartProvider>
      <App />
    </CartProvider>
  </BrowserRouter>
);
