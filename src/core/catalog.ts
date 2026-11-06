/**
 * Combat move catalog: the required library from the specification.
 * Each entry is a target that a character's clips can satisfy (matched by keywords in clip names).
 * Entries are NOT generated animations — they show what exists and what still needs importing.
 */
import type { Lang } from './i18n';

export type MoveCategory = 'locomotion' | 'punch' | 'kick' | 'acrobatics' | 'defense' | 'grapple' | 'weapon' | 'power';
export const MOVE_CATEGORIES: MoveCategory[] = ['locomotion', 'punch', 'kick', 'acrobatics', 'defense', 'grapple', 'weapon', 'power'];

export interface Move {
  id: string;
  cat: MoveCategory;
  fa: string;
  de: string;
  en: string;
  loop: boolean;
  rootMotion: 'in-place' | 'root';
  rig: 'humanoid' | 'humanoid+weapon';
  kw: string[]; // lower-case keywords matched against clip names
}

const M = (id: string, cat: MoveCategory, fa: string, de: string, en: string, kw: string[], loop = false, rootMotion: Move['rootMotion'] = 'in-place', rig: Move['rig'] = 'humanoid'): Move => ({ id, cat, fa, de, en, kw, loop, rootMotion, rig });

export const MOVES: Move[] = [
  // locomotion & stance
  M('idle', 'locomotion', 'ایستادن / نفس کشیدن', 'Stehen / Atmen', 'Idle / breathing', ['idle', 'breath', 'stand'], true),
  M('stance', 'locomotion', 'گارد مبارزه', 'Kampfhaltung', 'Fighting stance', ['stance', 'fight_idle', 'combat idle', 'ready'], true),
  M('walk', 'locomotion', 'راه رفتن', 'Gehen', 'Walk', ['walk'], true),
  M('run', 'locomotion', 'دویدن', 'Laufen', 'Run', ['run', 'jog'], true),
  M('sprint', 'locomotion', 'دوی سرعت', 'Sprinten', 'Sprint', ['sprint'], true),
  M('turn', 'locomotion', 'چرخیدن', 'Drehen', 'Turn', ['turn']),
  M('crouch', 'locomotion', 'نشستن نیم‌خیز', 'Hocken', 'Crouch', ['crouch'], true),
  M('kneel', 'locomotion', 'زانو زدن', 'Knien', 'Kneel', ['kneel']),
  M('sit', 'locomotion', 'نشستن', 'Sitzen', 'Sit', ['sit']),
  M('crawl', 'locomotion', 'سینه‌خیز', 'Kriechen', 'Crawl', ['crawl'], true),
  M('prone', 'locomotion', 'دراز کشیدن روی شکم/پشت', 'Liegen (Bauch/Rücken)', 'Lie prone / supine', ['prone', 'lying', 'lie']),
  M('getup', 'locomotion', 'بلند شدن', 'Aufstehen', 'Stand up', ['getup', 'get up', 'standing', 'stand up']),
  M('jump', 'locomotion', 'پرش', 'Sprung', 'Jump', ['jump']),
  M('jump_dir', 'locomotion', 'پرش جلو/عقب/پهلو', 'Sprung vor/zurück/seitlich', 'Forward/back/side jump', ['walkjump', 'jump forward', 'jump back', 'jump left', 'jump right'], false, 'root'),
  M('land', 'locomotion', 'فرود', 'Landung', 'Land', ['land']),
  // punches
  M('jab_l', 'punch', 'جب مستقیم چپ', 'Linke Gerade (Jab)', 'Left straight jab', ['jab', 'punch_l', 'left punch']),
  M('jab_r', 'punch', 'جب/مشت مستقیم راست', 'Rechte Gerade', 'Right straight / cross', ['punch', 'cross', 'right punch']),
  M('hook', 'punch', 'هوک', 'Haken', 'Hook', ['hook']),
  M('uppercut', 'punch', 'آپرکات', 'Aufwärtshaken', 'Uppercut', ['uppercut']),
  M('backfist', 'punch', 'بک‌فیست چرخشی', 'Gedrehter Rückhandschlag', 'Spinning backfist', ['backfist']),
  M('jump_punch', 'punch', 'مشت پرشی', 'Sprungschlag', 'Jumping punch', ['jump punch', 'jumping punch']),
  M('crouch_punch', 'punch', 'مشت نیم‌خیز', 'Hockschlag', 'Crouching punch', ['crouch punch']),
  M('double_strike', 'punch', 'ضربهٔ قدرتی دو دست', 'Beidhändiger Kraftschlag', 'Double-hand power strike', ['double', 'power strike']),
  M('run_punch', 'punch', 'مشت در حال دویدن', 'Laufschlag', 'Running punch', ['running punch']),
  M('punch_combo', 'punch', 'ترکیب سریع مشت (۳/۴/۵ ضربه)', 'Schnelle Schlagkombination', 'Fast punch combo (3/4/5)', ['combo', 'punch combo']),
  // kicks
  M('front_kick', 'kick', 'لگد جلو', 'Frontkick', 'Front kick', ['front kick', 'kick']),
  M('side_kick', 'kick', 'لگد پهلو', 'Sidekick', 'Side kick', ['side kick']),
  M('back_kick', 'kick', 'لگد عقب', 'Rückwärtstritt', 'Back kick', ['back kick']),
  M('roundhouse', 'kick', 'لگد چرخشی ایستاده', 'Roundhouse-Kick', 'Standing roundhouse', ['roundhouse']),
  M('sweep', 'kick', 'سوئیپ چرخشی نیم‌خیز', 'Gedrehter Feger', 'Crouching spinning sweep', ['sweep']),
  M('spin_kick', 'kick', 'لگد چرخشی (۳۶۰/۵۴۰)', 'Drehkick (360/540)', 'Spinning kick (360/540)', ['spin kick', 'spinning kick', '360', '540']),
  M('rising_kick', 'kick', 'لگد صعودی', 'Steigender Tritt', 'Rising kick', ['rising kick']),
  M('jump_kick', 'kick', 'لگد پرشی جلو/پهلو', 'Sprungtritt', 'Jumping front/side kick', ['jump kick', 'jumping kick']),
  M('flying_kick', 'kick', 'لگد پروازی به سر', 'Fliegender Seitwärtstritt', 'Flying head-height side kick', ['flying kick']),
  M('double_kick', 'kick', 'لگد پرشی دو پا', 'Doppelfuß-Sprungtritt', 'Double-foot jump kick', ['double kick', 'dropkick']),
  M('bicycle_kick', 'kick', 'قیچی برگردان (مثل فوتبال)', 'Fallrückzieher-Kick', 'Bicycle / scissor kick', ['bicycle', 'scissor']),
  M('kick_backflip', 'kick', 'لگد جلو + پشتک + فرود', 'Tritt + Rückwärtssalto + Landung', 'Kick into backflip & landing', ['kick flip', 'flip kick']),
  M('run_kick', 'kick', 'لگد در حال دویدن', 'Lauftritt', 'Running kick', ['running kick']),
  M('kick_combo', 'kick', 'ترکیب چند لگد', 'Trittkombination', 'Multi-kick combo', ['kick combo']),
  // acrobatics & evasion
  M('front_flip', 'acrobatics', 'پشتک جلو', 'Vorwärtssalto', 'Front flip', ['front flip', 'frontflip']),
  M('backflip', 'acrobatics', 'پشتک عقب ایستاده', 'Rückwärtssalto', 'Standing backflip', ['backflip', 'back flip']),
  M('cartwheel', 'acrobatics', 'چرخ و فلک', 'Radschlag', 'Cartwheel', ['cartwheel']),
  M('aerial_kick', 'acrobatics', 'پشتک هوایی با لگد', 'Luftsalto mit Tritt', 'Aerial flip with kick', ['aerial']),
  M('roll', 'acrobatics', 'غلت زمینی / شیرجه', 'Rolle / Hechtrolle', 'Ground / dive roll', ['roll']),
  M('dodge', 'acrobatics', 'جاخالی / گام کناری', 'Ausweichen / Seitschritt', 'Dodge / sidestep', ['dodge', 'sidestep', 'evade']),
  M('knockback', 'acrobatics', 'پرتاب به عقب', 'Rückstoß', 'Knockback', ['knockback']),
  // grapple, defense, damage
  M('grab', 'grapple', 'گرفتن با دو دست', 'Beidhändiger Griff', 'Two-hand grab', ['grab']),
  M('hold_release', 'grapple', 'نگه‌داشتن / رها کردن / هل دادن / پرتاب', 'Halten / Loslassen / Stoßen / Werfen', 'Hold / release / push / throw', ['hold', 'release', 'push', 'throw']),
  M('block', 'defense', 'دفاع دست / پا / شمشیر', 'Block (Hand/Fuß/Schwert)', 'Block (hand/kick/sword)', ['block', 'guard', 'parry']),
  M('hit', 'defense', 'واکنش ضربه (سبک/سنگین)', 'Trefferreaktion (leicht/schwer)', 'Hit reaction (light/heavy)', ['hit', 'stagger', 'react', 'no']),
  M('fall', 'defense', 'افتادن جلو/عقب/پهلو', 'Fallen vor/zurück/seitlich', 'Fall front/back/side', ['fall', 'knockdown']),
  M('death', 'defense', 'ناک‌اوت / مرگ', 'K.o. / Tod', 'Knockout / death', ['death', 'die', 'knockout', 'ko']),
  M('recover', 'defense', 'برخاستن پس از افتادن', 'Aufstehen nach Sturz', 'Get up after fall', ['recover', 'get up', 'standing']),
  // weapons
  M('draw', 'weapon', 'کشیدن / غلاف کردن سلاح', 'Ziehen / Wegstecken', 'Draw / sheath', ['draw', 'sheath', 'unsheath'], false, 'in-place', 'humanoid+weapon'),
  M('slash', 'weapon', 'ضربهٔ شمشیر/تبر', 'Schwert-/Axthieb', 'Sword / axe swing', ['slash', 'swing', 'sword', 'attack'], false, 'in-place', 'humanoid+weapon'),
  M('throw_weapon', 'weapon', 'پرتاب سلاح / ستاره نینجا', 'Waffe werfen / Shuriken', 'Throw weapon / shuriken', ['throw'], false, 'in-place', 'humanoid+weapon'),
  M('chain_throw', 'weapon', 'پرتاب و بازگرداندن سلاح زنجیری', 'Kettenwaffe werfen & zurückholen', 'Chain weapon throw & recall', ['chain', 'recall'], false, 'in-place', 'humanoid+weapon'),
  // elemental powers
  M('cast_one', 'power', 'پرتاب انرژی با یک دست', 'Energiewurf einhändig', 'One-hand projectile cast', ['cast', 'spell', 'punch']),
  M('cast_two', 'power', 'شلیک انرژی با دو دست', 'Energiestrahl beidhändig', 'Two-hand power beam', ['cast', 'beam', 'kamehameha']),
  M('celebrate', 'power', 'حرکت نمایشی / پیروزی', 'Siegespose', 'Taunt / victory pose', ['dance', 'thumbsup', 'yes', 'wave', 'victory', 'taunt'], true),
];

export function moveName(m: Move, lang: Lang): string {
  return m[lang];
}

/** Clips (by name) that match a move's keywords. */
export function clipsForMove(m: Move, clipNames: string[]): string[] {
  return clipNames.filter((c) => {
    const n = c.toLowerCase().replace(/[_-]+/g, ' ');
    // ≤2 letters: whole word; 3 letters: word prefix (run → running); longer: substring
    return m.kw.some((k) => (k.length <= 2 ? new RegExp(`(^|\\W)${k}(\\W|$)`).test(n) : k.length === 3 ? new RegExp(`(^|\\W)${k}`).test(n) : n.includes(k)));
  });
}

/** Best category guess for a clip name (for library filtering). */
export function categoryOfClip(name: string): MoveCategory | 'other' {
  for (const m of MOVES) if (clipsForMove(m, [name]).length) return m.cat;
  return 'other';
}
