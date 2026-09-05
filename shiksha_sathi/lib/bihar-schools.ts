import type { SchoolSearchResult } from "./api";

export const BIHAR_SCHOOLS: SchoolSearchResult[] = [
  {
    id: "sch-10280105528",
    name: "Govt. Girls High School Patna City",
    district_name: "Patna",
    block_name: "Patna City",
    udise_code: "10280105528",
  },
  {
    id: "sch-10280100101",
    name: "Patna Collegiate School",
    district_name: "Patna",
    block_name: "Patna Sadar",
    udise_code: "10280100101",
  },
  {
    id: "sch-10280100205",
    name: "Miller High School (Patna High School)",
    district_name: "Patna",
    block_name: "Gardanibagh",
    udise_code: "10280100205",
  },
  {
    id: "sch-10280101402",
    name: "Govt. Girls High School Gardanibagh",
    district_name: "Patna",
    block_name: "Gardanibagh",
    udise_code: "10280101402",
  },
  {
    id: "sch-10280100341",
    name: "B.N. Collegiate School",
    district_name: "Patna",
    block_name: "Patna Sadar",
    udise_code: "10280100341",
  },
  {
    id: "sch-10280104102",
    name: "Ram Lakhan Singh Yadav High School",
    district_name: "Patna",
    block_name: "Bakhtiyarpur",
    udise_code: "10280104102",
  },
  {
    id: "sch-10290100301",
    name: "Zila School Gaya",
    district_name: "Gaya",
    block_name: "Gaya Town",
    udise_code: "10290100301",
  },
  {
    id: "sch-10290200412",
    name: "Govt. High School Bodh Gaya",
    district_name: "Gaya",
    block_name: "Bodh Gaya",
    udise_code: "10290200412",
  },
  {
    id: "sch-10300100215",
    name: "Zila School Muzaffarpur",
    district_name: "Muzaffarpur",
    block_name: "Mushahari",
    udise_code: "10300100215",
  },
  {
    id: "sch-10310100118",
    name: "Chapra Zila School",
    district_name: "Saran",
    block_name: "Chhapra Sadar",
    udise_code: "10310100118",
  },
  {
    id: "sch-10320100520",
    name: "Zila School Bhagalpur",
    district_name: "Bhagalpur",
    block_name: "Nathnagar",
    udise_code: "10320100520",
  },
  {
    id: "sch-10330100410",
    name: "Nalanda Collegiate School",
    district_name: "Nalanda",
    block_name: "Bihar Sharif",
    udise_code: "10330100410",
  },
  {
    id: "sch-10340100322",
    name: "Zila School Darbhanga",
    district_name: "Darbhanga",
    block_name: "Darbhanga Sadar",
    udise_code: "10340100322",
  },
  {
    id: "sch-10350100230",
    name: "Zila School Purnia",
    district_name: "Purnia",
    block_name: "Purnia East",
    udise_code: "10350100230",
  },
  {
    id: "sch-10360100445",
    name: "Barauni High School",
    district_name: "Begusarai",
    block_name: "Barauni",
    udise_code: "10360100445",
  },
];

export function findBiharSchool(query: string): SchoolSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return BIHAR_SCHOOLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      (s.udise_code && s.udise_code.toLowerCase().includes(q)) ||
      s.district_name.toLowerCase().includes(q) ||
      (s.block_name && s.block_name.toLowerCase().includes(q)),
  );
}
