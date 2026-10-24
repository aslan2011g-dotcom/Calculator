const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const display = document.getElementById("display");

let expression = "";
let finished = false;

function render() {
  display.textContent = expression || "0";
}

function calculate() {
  if (!expression) return;

  try {
    // Разрешаем только цифры, операторы и скобки.
    if (!/^[0-9+\-*/%.()\s]+$/.test(expression)) {
      throw new Error("Недопустимое выражение");
    }

    // Вычисляем только после проверки символов.
    const result = Function(
      '"use strict"; return (' + expression + ')'
    )();

    if (!Number.isFinite(result)) {
      throw new Error("Ошибка вычисления");
    }

    expression = String(
      Math.round((result + Number.EPSILON) * 1e10) / 1e10
    );

    finished = true;
    render();
  } catch {
    display.textContent = "Ошибка";
    expression = "";
    finished = false;
  }
}

document.querySelector(".buttons").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const value = button.dataset.value;

  if (action === "clear") {
    expression = "";
    finished = false;
    render();
    return;
  }

  if (action === "delete") {
    expression = expression.slice(0, -1);
    finished = false;
    render();
    return;
  }

  if (action === "calculate") {
    calculate();
    return;
  }

  if (value !== undefined) {
    if (finished) {
      if ("0123456789.(".includes(value)) {
        expression = "";
      }
      finished = false;
    }

    expression += value;
    render();
  }
});

// Кнопка Backspace на физической клавиатуре.
document.addEventListener("keydown", (event) => {
  if (event.key === "Backspace") {
    expression = expression.slice(0, -1);
    finished = false;
    render();
  }

  if (event.key === "Enter" || event.key === "=") {
    calculate();
  }

  if (event.key === "Escape") {
    expression = "";
    finished = false;
    render();
  }
});
