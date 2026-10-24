import { el } from "./dom";

const portrait = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="18" fill="#b5e9f4"/>
  <path d="M10 7q4-3 8 0 5-3 10-1 5-2 10 0 5-3 9 0 5-2 8 2l-1 9 2 9-2 10 1 13H9l1-11-2-10 2-10Z" fill="#ffe34b" stroke="#b79125" stroke-width="1.5" stroke-linejoin="round"/>
  <g fill="#c4ae35" opacity=".75">
    <ellipse cx="14" cy="13" rx="2.6" ry="2"/>
    <ellipse cx="50" cy="14" rx="2" ry="3"/>
    <ellipse cx="13" cy="29" rx="2" ry="3"/>
    <ellipse cx="51" cy="44" rx="2.6" ry="2"/>
    <ellipse cx="15" cy="45" rx="3" ry="2"/>
  </g>
  <path d="m20 15-2-4m7 3v-4m6 5 2-4m3 4-2-4m8 3v-4m6 5 2-4" fill="none" stroke="#343128" stroke-width="2" stroke-linecap="round"/>
  <g stroke="#6d602f" stroke-width="1.2">
    <ellipse cx="24" cy="24" rx="10" ry="11" fill="#fff"/>
    <ellipse cx="43" cy="24" rx="10" ry="11" fill="#fff"/>
  </g>
  <g fill="#62bde8" stroke="#23668c" stroke-width="1">
    <ellipse cx="27" cy="25" rx="4.5" ry="5.5"/>
    <ellipse cx="40" cy="25" rx="4.5" ry="5.5"/>
  </g>
  <g fill="#202f3a">
    <ellipse cx="27" cy="25" rx="2.4" ry="3.5"/>
    <ellipse cx="40" cy="25" rx="2.4" ry="3.5"/>
  </g>
  <g fill="#fff"><circle cx="26" cy="23" r="1.2"/><circle cx="39" cy="23" r="1.2"/></g>
  <path d="M18 36q15 16 30 0-3 17-15 17T18 36" fill="#95412f"/>
  <path d="M25 48q8-6 16 0-8 7-16 0" fill="#ed887c"/>
  <path d="M26 38h7v8h-7Zm8 0h7v8h-7Z" fill="#fff" stroke="#6d602f" stroke-width="1" stroke-linejoin="round"/>
  <path d="M15 35q4-3 8 1m21 0q4-4 8-1" fill="none" stroke="#e6b52b" stroke-width="3" stroke-linecap="round"/>
  <g fill="#e97952"><circle cx="17" cy="36" r="1"/><circle cx="20" cy="34" r="1"/><circle cx="48" cy="34" r="1"/><circle cx="51" cy="36" r="1"/></g>
  <path d="M31 29q0-5 4-5t3 8q-3 5-7 1" fill="#ffe34b" stroke="#b79125" stroke-width="1.2"/>
  <path d="M9 51h46v7H9Z" fill="#fff"/>
  <path d="m23 51 9 4-5 4Zm19 0-10 4 6 4Z" fill="#fff" stroke="#c4c8ce" stroke-width="1"/>
  <path d="M9 58h46v6H9Z" fill="#a87543"/>
  <path d="m32 54 3 3-2 2 3 5h-8l3-5-2-2Z" fill="#ed4c3e"/>
  <path d="M13 60h8m22 0h8" stroke="#513d2e" stroke-width="2"/>
</svg>`)}`;

export function AgentAvatar(className: string) {
  const avatar = el("img", className);
  avatar.src = portrait;
  avatar.alt = "";
  avatar.setAttribute("aria-hidden", "true");
  avatar.draggable = false;
  return avatar;
}
