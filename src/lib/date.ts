const DATE_INPUT_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function todayDateInputValue() {
  return formatDateInputValue(new Date());
}

export function normalizeDateInputValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const dateInputMatch = trimmed.match(DATE_INPUT_PATTERN);
  if (dateInputMatch) return dateInputMatch[1];

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "";

  return formatDateInputValue(date);
}

export function toDateOnly(value: string) {
  const dateInputValue = normalizeDateInputValue(value);

  if (!dateInputValue) {
    throw new Error("Invalid date value");
  }

  return new Date(`${dateInputValue}T00:00:00.000Z`);
}
