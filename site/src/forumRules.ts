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
