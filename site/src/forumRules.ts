/** Shared by the site page and the site server (site/server/forum.ts). */
export const FORUM_CATEGORIES=[
 {id:'sugestoes',name:'Sugestões',hint:'Ideias para o jogo'},
 {id:'geral',name:'Geral',hint:'Conversa da comunidade'},
 {id:'duvidas',name:'Dúvidas',hint:'Perguntas e ajuda'},
 {id:'bugs',name:'Bugs do beta',hint:'Algo deu errado?'},
 {id:'guildas',name:'Guildas',hint:'Recrute e encontre grupo'},
] as const;
export type ForumCategory=typeof FORUM_CATEGORIES[number]['id'];
export const FORUM_LIMITS={titleMin:4,titleMax:90,bodyMin:2,topicMax:4000,replyMax:2000};
export const FORUM_PAGE=15;
/** Imagens e vídeos nas mensagens (site/server/media.ts). */
export const FORUM_MEDIA={perPost:4,perDay:40,/** Bytes one account may upload in 24 h. */perDayBytes:300*1048576,maxBytes:{image:5*1048576,video:30*1048576},accept:'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm'} as const;
export interface ForumMedia {id:string;kind:'image'|'video';url:string;}
