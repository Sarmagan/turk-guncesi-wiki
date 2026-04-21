import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const CATEGORIES = [
  "turk-edebiyati",
  "turk-folkloru",
  "turk-milliyetciligi",
  "turk-muzigi",
  "turk-tarihi",
  "turk-dili",
  "turk-mimarisi",
  "turk-mutfagi",
  "turk-sanati",
] as const;

export type CategorySlug = (typeof CATEGORIES)[number];

export const CATEGORY_DISPLAY: Record<CategorySlug, string> = {
  "turk-edebiyati": "Türk Edebiyatı",
  "turk-folkloru": "Türk Folkloru",
  "turk-milliyetciligi": "Türk Milliyetçiliği",
  "turk-muzigi": "Türk Müziği",
  "turk-tarihi": "Türk Tarihi",
  "turk-dili": "Türk Dili",
  "turk-mimarisi": "Türk Mimarisi",
  "turk-mutfagi": "Türk Mutfağı",
  "turk-sanati": "Türk Sanatı",
};

export const CATEGORY_DESCRIPTION: Record<CategorySlug, string> = {
  "turk-edebiyati":
    "Divan edebiyatından çağdaş romana kadar şairler, yazarlar, akımlar ve eserler.",
  "turk-folkloru":
    "Halk hikâyeleri, destanlar, masallar, gelenekler ve halk inançları.",
  "turk-milliyetciligi":
    "Türk milliyetçiliğinin düşünce tarihi, temel kavramlar ve figürler.",
  "turk-muzigi":
    "Türk halk müziği, Türk sanat müziği ve çağdaş Türk müziği üzerine kaynaklar.",
  "turk-tarihi":
    "İlk Türk devletlerinden Cumhuriyet dönemine uzanan geniş bir tarih ansiklopedisi.",
  "turk-dili":
    "Türk dilinin tarihi, lehçeleri, dil bilgisi ve etimoloji çalışmaları.",
  "turk-mimarisi":
    "Selçuklu, Osmanlı ve Cumhuriyet dönemi yapıları, mimarlar ve üsluplar.",
  "turk-mutfagi":
    "Bölgesel yemekler, tarihsel mutfak gelenekleri ve yiyecek kültürü.",
  "turk-sanati":
    "Hat, tezhip, minyatür, çini, resim ve çağdaş plastik sanatlar.",
};

export const CATEGORY_ICON: Record<CategorySlug, string> = {
  "turk-edebiyati": "book-open",
  "turk-folkloru": "campfire",
  "turk-milliyetciligi": "flag",
  "turk-muzigi": "music",
  "turk-tarihi": "scroll",
  "turk-dili": "letter",
  "turk-mimarisi": "columns",
  "turk-mutfagi": "bowl",
  "turk-sanati": "palette",
};

const wiki = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/wiki" }),
  schema: z.object({
    title: z.string().min(1),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    description: z.string().min(1),
    author: z.string().optional(),
    date: z.coerce.date(),
    image: z.string().optional(),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** If set, this file is a cross-listing only; all links and SEO use the canonical entry id. */
    canonicalEntryId: z.string().optional(),
  }),
});

export const collections = { wiki };
