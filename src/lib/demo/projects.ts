import {
  projectSchema,
  type EditorSegment,
  type Project,
} from "@/lib/ai/schemas/analysis";

const startupSegments: EditorSegment[] = [
  {
    id: "st-1",
    startTime: 4,
    endTime: 16,
    text: "Ер нь бол Монголын startup экосистем сүүлийн жилүүдэд нэлээд хурдан өсөж байгаа.",
    topic: "startup",
    keywords: ["startup", "Mongolia", "ecosystem"],
    importance: 0.91,
    visualRecommendation: {
      type: "IMAGE",
      description: "Жижиг студид ажиллаж буй startup үүсгэн байгуулагч",
      duration: 5,
      position: "right",
    },
    overlayText: "МОНГОЛЫН STARTUP ЭКОСИСТЕМ",
    scale: 1,
    opacity: 1,
  },
  {
    id: "st-2",
    startTime: 20,
    endTime: 36,
    text: "Гэхдээ хамгийн том асуудал бол үргэлж funding байдаггүй шүү дээ.",
    topic: "funding",
    keywords: ["funding", "investment", "problem"],
    importance: 0.86,
    visualRecommendation: {
      type: "GRAPHIC",
      description: "Хөрөнгө оруулалтыг харуулсан нам гүм graphic",
      duration: 5,
      position: "right",
    },
    overlayText: "ХӨРӨНГӨ ОРУУЛАЛТ",
    scale: 1,
    opacity: 1,
  },
  {
    id: "st-3",
    startTime: 42,
    endTime: 62,
    text: "Зөв хэрэглэгчээ олох чинь ихэвчлэн хамаагүй хэцүү.",
    topic: "customers",
    keywords: ["customers", "sales", "market"],
    importance: 0.94,
    visualRecommendation: {
      type: "IMAGE",
      description: "Үүсгэн байгуулагч хоёр хэрэглэгчтэй ярьж байна",
      duration: 6,
      position: "left",
    },
    overlayText: "ЗӨВ ХЭРЭГЛЭГЧ",
    scale: 1,
    opacity: 1,
  },
];

const trafficSegments: EditorSegment[] = [
  {
    id: "tr-1",
    startTime: 3,
    endTime: 14,
    text: "Улаанбаатарын замын түгжрэл сүүлийн жилүүдэд маш их нэмэгдсэн.",
    topic: "traffic",
    keywords: ["Ulaanbaatar", "traffic", "roads"],
    importance: 0.9,
    visualRecommendation: {
      type: "BROLL",
      description: "Улаанбаатарын замын хөдөлгөөн",
      duration: 5,
      position: "right",
    },
    overlayText: "УЛААНБААТАРЫН ТҮГЖРЭЛ",
    scale: 1,
    opacity: 1,
  },
  {
    id: "tr-2",
    startTime: 18,
    endTime: 32,
    text: "Өглөө орой хоёр цагт хот бараг хөдлөхгүй болдог.",
    topic: "traffic",
    keywords: ["commute", "morning", "evening"],
    importance: 0.74,
    visualRecommendation: {
      type: "IMAGE",
      description: "Уулзварт хүлээж буй машинууд",
      duration: 4,
      position: "right",
    },
    overlayText: "ӨГЛӨӨ, ОРОЙ",
    scale: 1,
    opacity: 1,
  },
  {
    id: "tr-3",
    startTime: 38,
    endTime: 52,
    text: "Тиймээс цагаа арай эрт гаргах нь одоо бол жирийн зүйл.",
    topic: "traffic",
    keywords: ["time", "habit"],
    importance: 0.62,
    visualRecommendation: {
      type: "TEXT",
      description: "Яригчийг ил үлдээж, богино бичвэр харуулна",
      duration: 3,
      position: "bottom",
    },
    overlayText: "ЦАГАА ЭРТ ГАРГА",
    scale: 1,
    opacity: 1,
  },
];

const customerSegments: EditorSegment[] = [
  {
    id: "cu-1",
    startTime: 2,
    endTime: 16,
    text: "Хэрэглэгчээ олох гээд бүгдийг нь нэг дор харах хэрэггүй.",
    topic: "customers",
    keywords: ["customers", "focus"],
    importance: 0.82,
    visualRecommendation: {
      type: "IMAGE",
      description: "Хөршийн дэлгүүр дэх жижиг бүлэг",
      duration: 4,
      position: "right",
    },
    overlayText: "НЭГ БҮЛЭГ, ТОДОРХОЙ",
    scale: 1,
    opacity: 1,
  },
  {
    id: "cu-2",
    startTime: 20,
    endTime: 38,
    text: "Эхний арван хүн л чамд хамгийн их юм хэлнэ.",
    topic: "customers",
    keywords: ["interviews", "first customers"],
    importance: 0.88,
    visualRecommendation: {
      type: "HIGHLIGHT",
      description: "Эхний арван хүнийг нэрлэх үед яригчийг тодотгоно",
      duration: 4,
      position: "bottom",
    },
    overlayText: "ЭХНИЙ 10 ХЭРЭГЛЭГЧ",
    scale: 1,
    opacity: 1,
  },
];

const rawProjects = [
  {
    id: "startup",
    title: "Монголын startup экосистем",
    filename: "startup-ecosystem.mp4",
    duration: 72,
    createdAt: "2026-10-08T02:00:00.000Z",
    status: "READY",
    segments: startupSegments,
  },
  {
    id: "traffic",
    title: "Улаанбаатарын түгжрэл",
    filename: "ub-traffic.mov",
    duration: 58,
    createdAt: "2026-10-06T08:30:00.000Z",
    status: "READY",
    segments: trafficSegments,
  },
  {
    id: "customers",
    title: "Эхний 10 хэрэглэгч",
    filename: "first-customers.mp4",
    duration: 48,
    createdAt: "2026-10-02T11:00:00.000Z",
    status: "DRAFT",
    segments: customerSegments,
  },
] as const;

export const projects: Project[] = rawProjects.map((project) => projectSchema.parse(project));

export const SAMPLE_VIDEO = {
  name: "жишээ-видео.mp4",
  duration: 72,
  projectId: "startup",
} as const;

export function listProjects(): Project[] {
  return projects;
}

export function getProject(id: string): Project | undefined {
  return projects.find((project) => project.id === id);
}

export function primarySegment(project: Project): EditorSegment | undefined {
  return project.segments[0];
}
