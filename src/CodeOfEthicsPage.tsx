import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CodeOfEthicsContent } from "./CodeOfEthicsContent";

function CodeOfEthicsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="bg-[#dedede] border-b-2 border-gray-500">
        <div className="w-full">
          <a href="./" className="mx-auto">
            <img
              className="mx-auto"
              src="/br-banner.jpg"
              width="75%"
              height="75%"
              alt="Bittrees Research banner"
            />
          </a>
        </div>
      </header>

      <main className="text-center bg-[#dedede]">
        <div className="flex flex-col gap-3 p-4 md:p-12 items-center">
              
          <div className="mt-4">
            <CodeOfEthicsContent />
          </div>

          <footer className="flex flex-col gap-6 mx-auto mt-4">
            <span>
              <a className="hover:text-green-700" href="/members">
                <span className="inline-block align-middle pr-1"><svg className="h-4 w-4 hover:text-green-700"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round">  <circle cx="12" cy="12" r="10" />  <polyline points="12 8 8 12 12 16" />  <line x1="16" y1="12" x2="8" y2="12" /></svg></span>
                <span className="inline-block align-middle underline font-bold font-newtimesroman">Member Services</span>
              </a>
            </span>
            <span>
              <div>
                <ConnectButton />
              </div>
            </span>
            <div className="flex w-full justify-center items-center">
              <a href="/" className="mx-auto">
                <img
                  src="/bittrees_logo_tree.png"
                  width="128px"
                  height="128px"
                  alt="Bittrees Research logo"
                  className="grayscale max-w-xs transition duration-300 ease-in-out hover:scale-110"
                />
              </a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default CodeOfEthicsPage;