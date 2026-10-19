/** Which part of each painted cosmetic a Color Ticket repaints (docs/color-tickets.md).
 * Without `hue` the whole piece changes (hair). With `hue`, only the painted pixels near that hue
 * (0–1, HSL) and at least `minSaturation` change, so trims, metal and details keep their colors.
 * Every hair, hat, glasses and outfit needs an entry; `npm run verify:cosmetics` checks coverage. */
export interface RecolorZone {label:string;hue?:number;tolerance?:number;minSaturation?:number;}

export const RECOLOR_ZONES:Readonly<Record<string,RecolorZone>>={
 'hair-wavy':{label:'O cabelo inteiro'},
 'hair-undercut':{label:'O cabelo inteiro'},
 'hair-ponytail':{label:'O cabelo inteiro'},
 'hair-horizon':{label:'O cabelo inteiro'},
 'hair-captain':{label:'O cabelo inteiro'},
 'hair-hiphop':{label:'O cabelo inteiro'},
 'hair-swordsman':{label:'O cabelo inteiro'},
 'hat-cap':{label:'A copa do boné; a aba e a estrela ficam como estão',hue:.27,tolerance:.07,minSaturation:.2},
 'hat-thunder':{label:'A copa do boné; a aba e o raio ficam como estão',hue:.985,tolerance:.05,minSaturation:.3},
 'hat-tide':{label:'O tecido do chapéu; a faixa e a concha ficam como estão',hue:.5,tolerance:.06,minSaturation:.25},
 'hat-ruby':{label:'A boina; a faixa e a pena ficam como estão',hue:.925,tolerance:.05,minSaturation:.3},
 'hat-tropical':{label:'A palha do chapéu; a faixa e a flor ficam como estão',hue:.1,tolerance:.045,minSaturation:.3},
 'hat-captain':{label:'O tecido vermelho; a aba, o cordão e o emblema ficam como estão',hue:.99,tolerance:.04,minSaturation:.35},
 'hat-hiphop':{label:'A copa roxa; a aba e a estrela ficam como estão',hue:.77,tolerance:.05,minSaturation:.35},
 'hat-swordsman':{label:'A palha; os cordões e a borla ficam como estão',hue:.11,tolerance:.04,minSaturation:.35},
 'hat-mage':{label:'O tecido do chapéu; as estrelas e o cinto ficam como estão',hue:.71,tolerance:.06,minSaturation:.25},
 'glasses-sport':{label:'A armação e as lentes'},
 'glasses-cat':{label:'A armação e as lentes'},
 'glasses-navigator':{label:'A armação; as lentes ficam como estão',hue:.04,tolerance:.05,minSaturation:.3},
 'glasses-hiphop':{label:'A armação e as lentes'},
 'glasses-captain':{label:'A armação e as lentes'},
 'outfit-captain':{label:'A casaca vermelha; o dourado, o preto e o branco ficam como estão',hue:.99,tolerance:.04,minSaturation:.35},
 'outfit-hiphop':{label:'O moletom roxo; o dourado, a calça e os tênis ficam como estão',hue:.77,tolerance:.05,minSaturation:.35},
 'outfit-swordsman':{label:'O haori verde-azulado; o quimono, a faixa e a hakama ficam como estão',hue:.52,tolerance:.05,minSaturation:.3},
 'outfit-cartographer':{label:'O casaco azul; o dourado fica como está',hue:.63,tolerance:.06,minSaturation:.25}
};
/** Share of a piece's painted pixels that may change: too little reads as "nothing happened", too much
 * for a detail zone means the hue band caught the whole piece (or skin). Whole-piece zones skip the max. */
export const RECOLOR_COVERAGE={min:.06,max:.85} as const;
