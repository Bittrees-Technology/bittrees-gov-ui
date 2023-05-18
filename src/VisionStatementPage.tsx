import { VisionStatementContent } from "./VisionStatementContent";

function VisionStatementPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="border-2 bg-white">
        <div className="w-full">
          <a href="./" className="mx-auto">
            <div className="font-newtimesroman py-20 text-4xl sm:text-6xl text-center font-bold tracking-wider">
              Bittrees, Inc
            </div>
          </a>
        </div>
      </header>

      <main className="text-center bg-white border-2 border-t-0">
        <div className="flex flex-col gap-3 p-4 md:p-12 items-center">
          <div className="mt-4">
            <VisionStatementContent />
          </div>

          <footer className="flex flex-col gap-6 mx-auto mt-4">
            <span>
              <a className="hover:text-green-700" href="/">
                <span className="inline-block align-middle pr-1">
                  <svg
                    className="h-4 w-4 hover:text-green-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    {" "}
                    <circle cx="12" cy="12" r="10" />{" "}
                    <polyline points="12 8 8 12 12 16" />{" "}
                    <line x1="16" y1="12" x2="8" y2="12" />
                  </svg>
                </span>
                <span className="inline-block align-middle underline font-bold font-newtimesroman">
                  Back
                </span>
              </a>
            </span>

            <div className="flex w-full justify-center items-center">
              <a href="/" className="mx-auto">
                <img
                  src="/bittrees_logo_tree.png"
                  width="128px"
                  height="128px"
                  alt="Bittrees Inc logo"
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

export default VisionStatementPage;
