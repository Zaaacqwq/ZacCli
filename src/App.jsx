import { useEffect, useRef, useState } from "react";

const INITIAL_HISTORY = [
  {
    kind: "system",
    text: "System online. Type <code>help</code> to begin.",
  },
];

const ROUTES = {
  blog: "https://blog.zaaac.vip",
  portfolio: "https://portfolio.zaaac.vip",
  home: "https://zaaac.vip",
};

function openInNewTab(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildHelpLines(commands) {
  const lines = Object.entries(commands).map(
    ([name, config]) => `${name.padEnd(10, " ")}${config.description}`,
  );

  return ["Available commands:", ...lines, "Aliases: go <name>, open <name>"];
}

export default function App() {
  const [inputValue, setInputValue] = useState("");
  const [clock, setClock] = useState("");
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const inputRef = useRef(null);
  const historyRef = useRef(null);

  const appendLines = (lines) => {
    setHistory((current) => current.concat(lines));
  };

  const commands = {
    help: {
      description: "Show all available commands.",
      action: () => buildHelpLines(commands).map((text) => ({ kind: "info", text })),
    },
    blog: {
      description: "Open the blog subdomain.",
      action: () => {
        appendLines([{ kind: "system", text: "Routing to https://blog.zaaac.vip ..." }]);
        window.setTimeout(() => {
          openInNewTab(ROUTES.blog);
        }, 220);
        return [];
      },
    },
    portfolio: {
      description: "Open the portfolio subdomain.",
      action: () => {
        appendLines([{ kind: "system", text: "Routing to https://portfolio.zaaac.vip ..." }]);
        window.setTimeout(() => {
          openInNewTab(ROUTES.portfolio);
        }, 220);
        return [];
      },
    },
    home: {
      description: "Return to the main domain.",
      action: () => {
        appendLines([{ kind: "system", text: "Refreshing terminal state ..." }]);
        window.setTimeout(() => {
          openInNewTab(ROUTES.home);
        }, 220);
        return [];
      },
    },
    about: {
      description: "Show information about this site.",
      action: () => [
        { kind: "info", text: "zaaac.vip is a command-driven landing page." },
        {
          kind: "info",
          text: "Use short commands to jump across subdomains and utilities.",
        },
        {
          kind: "info",
          text: "The interface is designed to feel like a personal terminal shell.",
        },
      ],
    },
    links: {
      description: "List direct subdomain URLs.",
      action: () => [
        { kind: "info", text: "Quick links:" },
        { kind: "info", text: "blog       https://blog.zaaac.vip" },
        { kind: "info", text: "portfolio  https://portfolio.zaaac.vip" },
        { kind: "info", text: "root       https://zaaac.vip" },
      ],
    },
    clear: {
      description: "Clear the terminal history.",
      action: () => {
        setHistory([
          {
            kind: "system",
            text: "Terminal cleared. Type <code>help</code> to continue.",
          },
        ]);
        return [];
      },
    },
  };

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleString("en-CA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          month: "short",
          day: "2-digit",
        }),
      );
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();

    const handleWindowClick = () => {
      inputRef.current?.focus();
    };

    window.addEventListener("click", handleWindowClick);
    return () => {
      window.removeEventListener("click", handleWindowClick);
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();

    const value = inputValue.trim().toLowerCase();
    if (!value) {
      return;
    }

    const normalizedValue = value.replace(/^(go|open)\s+/, "");
    const command = commands[normalizedValue];

    setHistory((current) => current.concat({ kind: "command", text: `&gt; ${value}` }));
    setInputValue("");

    if (!command) {
      appendLines([
        {
          kind: "error",
          text: `Unknown command: <code>${value}</code>. Try <code>help</code>.`,
        },
      ]);
      return;
    }

    const lines = command.action();
    if (lines.length > 0) {
      appendLines(lines);
    }
  };

  return (
    <>
      <div className="background-grid" aria-hidden="true" />
      <main className="shell" aria-label="zaaac.vip terminal interface">
        <section className="hero">
          <p className="eyebrow">zaaac.vip / root node</p>
          <div className="logo-frame">
            <h1 className="logo" aria-label="ZAAAC terminal" data-text="ZAAAC">
              <span>ZAAAC</span>
            </h1>
          </div>
          <p className="hero-copy">
            A command-first homepage. Type a destination or utility command and
            press Enter.
          </p>
        </section>

        <section className="tips" aria-labelledby="tips-title">
          <h2 id="tips-title">Boot Tips</h2>
          <ol>
            <li>
              Use <code>blog</code> to open <code>blog.zaaac.vip</code>.
            </li>
            <li>
              Use <code>portfolio</code> to open <code>portfolio.zaaac.vip</code>.
            </li>
            <li>
              Type <code>links</code> or <code>help</code> for more commands.
            </li>
          </ol>
        </section>

        <section className="terminal" aria-label="Command terminal">
          <div className="terminal-topbar">
            <span>CLI navigator ready</span>
            <span aria-live="off">{clock}</span>
          </div>

          <div className="terminal-body">
            <div ref={historyRef} className="history" aria-live="polite">
              {history.map((entry, index) => (
                <div
                  key={`${entry.kind}-${index}`}
                  className={`output-line ${entry.kind}`}
                  dangerouslySetInnerHTML={{ __html: entry.text }}
                />
              ))}
            </div>

            <form className="prompt-row" autoComplete="off" onSubmit={handleSubmit}>
              <label className="prompt-symbol" htmlFor="command-input">
                &gt;
              </label>
              <input
                ref={inputRef}
                id="command-input"
                name="command"
                type="text"
                spellCheck="false"
                autoCapitalize="off"
                autoComplete="off"
                aria-label="Terminal command input"
                placeholder="Enter command: blog, portfolio, help..."
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
              />
            </form>

            <div className="terminal-footer">
              <span>~/zaaac.vip</span>
              <span>subdomain router</span>
              <span>react build</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
