import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import MintPage from "./MintPage";
import MembersPage from "./MembersPage";
import CodeOfConductPage from "./CodeOfConductPage";
import VisionStatementPage from "./VisionStatementPage";
import reportWebVitals from "./reportWebVitals";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { EthereumClient } from "@web3modal/ethereum";
import { Web3Modal } from "@web3modal/react";
import { configureChains, createClient, WagmiConfig } from "wagmi";
import {
  mainnet,
  // goerli,
} from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { publicProvider } from "wagmi/providers/public";

// const myChain =
//   process.env.REACT_APP_ENABLE_TESTNETS === "true" ? goerli : mainnet;

const myChain = mainnet;

const { chains, provider, webSocketProvider } = configureChains(
  [myChain],
  [
    alchemyProvider({ apiKey: "MY6sRxkJ6Jeo6Pd_6XvgrmvXJFbrQE0w" }),
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: "Bittrees Governance",
  projectId: "c3ce6198ddd9adbe0eb23a626742dbf7",
  chains,
});

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});

const ethereumClient = new EthereumClient(wagmiClient, chains);

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/mint",
    element: <MintPage />,
  },
  {
    path: "/members",
    element: <MembersPage />,
  },
  {
    path: "/codeofconduct",
    element: <CodeOfConductPage />,
  },
  {
    path: "/visionstatement",
    element: <VisionStatementPage />,
  },
]);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <>
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider chains={chains}>
        <RouterProvider router={router} />
      </RainbowKitProvider>
    </WagmiConfig>

    <Web3Modal
      projectId="c3ce6198ddd9adbe0eb23a626742dbf7"
      ethereumClient={ethereumClient}
    />
  </>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
