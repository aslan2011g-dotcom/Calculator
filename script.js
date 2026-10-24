const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const display = document.getElementById("display");
const previous = document.getElementById("previous");
const buttons = document.querySelector(".buttons");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");

let expression = "";
let finished = false;
let history = [];

function render() {
  display.textContent = expression || "0";
}

function tokenize(input) {
  const tokens = input.match(
    /\d+(?:\.\d*)?|\.\d+|[+\-*/()%]/g
  );

  if (!tokens || tokens.join("") !== input.replace(/\s/g, "")) {
    throw new Error("Некорректное выражение");
  }

  return tokens;
}

function evaluate(input) {
  const tokens = tokenize(input);
  let pos = 0;

  function primary() {
    const token = tokens[pos++];

    if (token === "+") return primary();
    if (token === "-") return -primary();

    if (token === "(") {
      const value = addSub();
      if (tokens[pos++] !== ")") throw new Error("Скобки");
      return value;
    }

    if (token === undefined || !/^(?:\d+\.?\d*|\.\d+)$/.test(token)) {
      throw new Error("Число");
    }

    return Number(token);
  }

  function mulDiv() {
    let value = primary();

    while (tokens[pos] === "*" || tokens[pos] === "/") {
      const op = tokens[pos++];
      const right = primary();

      if (op === "/" && right === 0) throw new Error("Деление на ноль");

      value = op === "*" ? value * right : value / right;
    }

    return value;
  }

  function addSub() {
    let value = mulDiv();

    while (tokens[pos] === "+" || tokens[pos] === "-") {
      const op = tokens[pos++];
      const right = mulDiv();

      value = op === "+" ? value + right : value - right;
    }

    return value;
  }

  const result = addSub();

  if (pos !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Ошибка");
  }

  return result;
}

function format(value) {
  return String(Number(value.toPrecision(12)));
}

function renderHistory() {
  if (!history.length) {
    historyList.textContent = "Пока нет вычислений";
    return;
  }

  historyList.replaceChildren();

  history.slice().reverse().forEach(item => {
    const row = document.createElement("div");
    row.className = "history-entry";
    row.textContent = `${item.expression} = ${item.result}`;
    historyList.appendChild(row);
  });
}

function calculate() {
  if (!expression) return;

  try {
    const source = expression;
    const result = evaluate(source);

    previous.textContent = source + " =";
    expression = format(result);
    finished = true;

    history.push({ expression: source, result: expression });
    renderHistory();
    render();

    tg?.HapticFeedback?.notificationOccurred("success");
  } catch {
    display.textContent = "Ошибка";
    tg?.HapticFeedback?.notificationOccurred("error");
    expression = "";
    finished = false;
  }
}

buttons.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, value } = button.dataset;
  tg?.HapticFeedback?.selectionChanged();

  if (action === "clear") {
    expression = "";
    previous.textContent = "";
    finished = false;
    render();
    return;
  }

  if (action === "delete") {
    if (finished) {
      expression = "";
      finished = false;
    } else {
      expression = expression.slice(0, -1);
    }
    render();
    return;
  }

  if (action === "calculate") {
    calculate();
    return;
  }

  if (action === "percent") {
    if (!expression || finished) return;

    try {
      expression = format(evaluate(expression) / 100);
      render();
    } catch {
      display.textContent = "Ошибка";
      expression = "";
    }
    return;
  }

  if (action === "sign") {
    if (!expression || finished) {
      expression = expression ? "-" + expression : "-";
      finished = false;
      render();
      return;
    }

    try {
      expression = format(-evaluate(expression));
      render();
    } catch {
      // Оставляем выражение без изменений.
    }
    return;
  }

  if (value !== undefined) {
    if (finished) {
      expression = /[0-9.(]/.test(value) ? "" : expression;
      finished = false;
      previous.textContent = "";
    }

    expression += value;
    render();
  }
});

document.getElementById("historyBtn").addEventListener("click", () => {
  historyPanel.hidden = !historyPanel.hidden;
  renderHistory();
});

document.getElementById("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("light");
});

document.getElementById("clearHistory").addEventListener("click", () => {
  history = [];
  renderHistory();
});

document.addEventListener("keydown", event => {
  if (/^[0-9.+\-*/()]$/.test(event.key)) {
    expression += event.key;
    finished = false;
    render();
  } else if (event.key === "Enter" || event.key === "=") {
    calculate();
  } else if (event.key === "Backspace") {
    expression = expression.slice(0, -1);
    finished = false;
    render();
  } else if (event.key === "Escape") {
    expression = "";
    finished = false;
    render();
  }
});

render();
