import { useLocalStorage } from "@vueuse/core";

/**
 * Persistent anime-style guest identity for anonymous users.
 * Generated once per browser, stored in localStorage forever.
 * Format: "{JapaneseName}{suffix}" e.g. "Hoshi-senpai", "Maki-chan"
 */

export const LIST_GUEST_NAME = [
  "Akira",
  "Haru",
  "Yuki",
  "Sora",
  "Rin",
  "Maki",
  "Rei",
  "Kai",
  "Aoi",
  "Nao",
  "Kyo",
  "Mio",
  "Tomo",
  "Shin",
  "Riku",
  "Hina",
  "Yui",
  "Kou",
  "Mei",
  "Len",
  "Chiro",
  "Sakura",
  "Nagi",
  "Rena",
  "Tsumugi",
  "Kaede",
  "Shion",
  "Minato",
  "Haruka",
  "Asuka",
  "Itsuki",
  "Fuu",
  "Kohaku",
  "Sumire",
  "Tsuki",
  "Kumo",
  "Hoshi",
  "Yoru",
  "Kaze",
  "Umi",
  "Hikari",
  "Saki",
  "Miku",
  "Ryo",
  "Natsuki",
  "Ayame",
  "Izumi",
  "Kanata",
  "Misaki",
  "Hinata",
  "Tsubasa",
  "Hotaru",
  "Kokoro",
  "Suzume",
  "Nagisa",
  "Shiori",
  "Chihiro",
  "Tamaki",
  "Kazuki",
  "Yuuto",
];

export const LIST_GUEST_SUFFIX = [
  "-kun",
  "-chan",
  "-san",
  "-senpai",
  "-sama",
  "-tan",
  "-chi",
  "-rin",
  "-pyon",
  "-nyan",
];

/** Deterministic guest name from a numeric ID (e.g. comment.id). */
export const guestNameFromId = (id: number): string => {
  const name = LIST_GUEST_NAME[id % LIST_GUEST_NAME.length];
  const suffix = LIST_GUEST_SUFFIX[(id * 7) % LIST_GUEST_SUFFIX.length];
  return `${name}${suffix}`;
};

const STORAGE_KEY = "yozora_guest_name";

const generateGuestName = (): string => {
  const name =
    LIST_GUEST_NAME[Math.floor(Math.random() * LIST_GUEST_NAME.length)];
  const suffix =
    LIST_GUEST_SUFFIX[Math.floor(Math.random() * LIST_GUEST_SUFFIX.length)];
  return `${name}${suffix}`;
};

export const useGuestIdentity = () => {
  const guestName = useLocalStorage(STORAGE_KEY, generateGuestName());
  if (!guestName.value) {
    guestName.value = generateGuestName();
  }
  return { guestName };
};
