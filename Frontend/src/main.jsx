import './index.css'
import App from './App.jsx'
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { CartProvider } from "./modules/cart";
import { installErrorReporting } from "./shared/lib/reportError.js";

// PLAT-04. Installed before render so a failure during the first mount is still reported;
// catches what React's error boundary cannot see — a throw in an event handler, a rejected
// promise nobody awaited, a chunk that failed to parse.
installErrorReporting();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <CartProvider>
      <App />
    </CartProvider>
  </BrowserRouter>
);
