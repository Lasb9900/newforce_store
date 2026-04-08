const BUSINESS_TIME_ZONE = process.env.STORE_TIME_ZONE || "America/Los_Angeles";

function getFormatter(timeZone = BUSINESS_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getBusinessDateInputValue(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("No se pudo resolver la fecha del negocio");
  }

  return `${year}-${month}-${day}`;
}

export function formatBusinessDateTime(date: string | Date, locale = "en-US", timeZone = BUSINESS_TIME_ZONE) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const offsetValue = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = offsetValue.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
}

function zonedDateTimeToUtcIso(dateInput: string, timeZone: string, endOfDay: boolean) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;

  const localMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let offsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date(localMs));
  let utcMs = localMs - offsetMinutes * 60_000;

  const refinedOffsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date(utcMs));
  if (refinedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = refinedOffsetMinutes;
    utcMs = localMs - offsetMinutes * 60_000;
  }

  return new Date(utcMs).toISOString();
}

export function getBusinessDayRange(dateInput: string, timeZone = BUSINESS_TIME_ZONE) {
  return {
    fromIso: zonedDateTimeToUtcIso(dateInput, timeZone, false),
    toIso: zonedDateTimeToUtcIso(dateInput, timeZone, true),
  };
}