import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

// Product type IDs from DB
const PT = {
  GLP1: "d1a6ab09-d353-4360-b87f-678aac5b16f4",
  HORMONE: "c5aee9fc-012f-4155-b356-8e26ffb22ea5",
  THYROID: "d11e8020-85fe-4029-9404-5aeec0d94c90",
  SEXUAL: "4efc1111-50bd-4453-8ecb-427f22ab1c16",
  HAIR: "7b1616fb-f0f4-4f28-951d-4348f8658c22",
  ANTIAGING: "72d687a2-04c9-494e-8d21-5a316f93fc4f",
  PEPTIDES: "ed3b05bc-2bd3-455c-8203-03029b2c5329",
  VITAMINS: "07f076c2-17c6-4ff9-adf1-8917f595b8c0",
};

interface RawRow {
  name: string;
  form: string;
  strength: string;
  size: string;
  viosId: string;
  basePrice: number;
  retailPrice: number;
}

// All 305 rows from spreadsheet (deduplicated)
const RAW_DATA: RawRow[] = [
  // === GLP-1: Semaglutide/Methylcobalamin/Glycine ===
  {name:"Semaglutide/Methylcobalamin/Glycine",form:"Injection",strength:"1mg/1mg/10mg/ml",size:"1mL",viosId:"305515988",basePrice:36.96,retailPrice:51.74},
  {name:"Semaglutide/Methylcobalamin/Glycine",form:"Injection",strength:"1mg/1mg/10mg/ml",size:"2.5mL",viosId:"305515541",basePrice:38.19,retailPrice:53.47},
  {name:"Semaglutide/Methylcobalamin/Glycine",form:"Injection",strength:"5mg/1mg/10mg/ml",size:"1mL",viosId:"305515539",basePrice:45.58,retailPrice:63.81},
  {name:"Semaglutide/Methylcobalamin/Glycine",form:"Injection",strength:"5mg/1mg/10mg/ml",size:"1.5mL",viosId:"305746275",basePrice:49.28,retailPrice:68.99},
  {name:"Semaglutide/Methylcobalamin/Glycine",form:"Injection",strength:"5mg/1mg/10mg/ml",size:"2mL",viosId:"305746244",basePrice:57.90,retailPrice:81.06},
  {name:"Semaglutide/Methylcobalamin/Glycine",form:"Injection",strength:"5mg/1mg/10mg/ml",size:"2.5mL",viosId:"305515540",basePrice:64.06,retailPrice:89.68},
  // === GLP-1: Semaglutide/L-Carnitine ===
  {name:"Semaglutide/L-Carnitine",form:"Injection",strength:"1mg/100mg/ml",size:"3mL",viosId:"305518911",basePrice:40.04,retailPrice:56.06},
  {name:"Semaglutide/L-Carnitine",form:"Injection",strength:"2mg/100mg/ml",size:"2mL",viosId:"305525208",basePrice:42.82,retailPrice:59.95},
  {name:"Semaglutide/L-Carnitine",form:"Injection",strength:"2mg/100mg/ml",size:"4mL",viosId:"305525209",basePrice:51.74,retailPrice:72.44},
  {name:"Semaglutide/L-Carnitine",form:"Injection",strength:"5mg/100mg/ml",size:"2mL",viosId:"305525204",basePrice:64.06,retailPrice:89.68},
  // === GLP-1: Tirzepatide/Glycine/Methylcobalamin ===
  {name:"Tirzepatide/Glycine/Methylcobalamin",form:"Injection",strength:"8.5mg/10mg/1mg/ml",size:"1mL",viosId:"305757197",basePrice:61.60,retailPrice:86.24},
  {name:"Tirzepatide/Glycine/Methylcobalamin",form:"Injection",strength:"8.5mg/10mg/1mg/ml",size:"2mL",viosId:"305325593",basePrice:67.76,retailPrice:94.86},
  {name:"Tirzepatide/Glycine/Methylcobalamin",form:"Injection",strength:"17mg/10mg/1mg/ml",size:"2mL",viosId:"305501763",basePrice:104.72,retailPrice:146.61},
  {name:"Tirzepatide/Glycine/Methylcobalamin",form:"Injection",strength:"17mg/10mg/1mg/ml",size:"3mL",viosId:"305757198",basePrice:147.84,retailPrice:206.98},
  {name:"Tirzepatide/Glycine/Methylcobalamin",form:"Injection",strength:"17mg/10mg/1mg/ml",size:"4mL",viosId:"305506854",basePrice:184.80,retailPrice:258.72},
  // === GLP-1: Tirzepatide/L-Carnitine ===
  {name:"Tirzepatide/L-Carnitine",form:"Injection",strength:"10mg/100mg/ml",size:"1mL",viosId:"305525210",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide/L-Carnitine",form:"Injection",strength:"10mg/100mg/ml",size:"3mL",viosId:"305525212",basePrice:98.56,retailPrice:137.98},
  {name:"Tirzepatide/L-Carnitine",form:"Injection",strength:"20mg/100mg/ml",size:"3mL",viosId:"305525213",basePrice:166.32,retailPrice:232.85},
  // === GLP-1: Semaglutide ODT ===
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"250 MCG",size:"30ct",viosId:"305518607",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"500 MCG",size:"30ct",viosId:"305518616",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"1 MG",size:"30ct",viosId:"305518550",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"1.5 MG",size:"30ct",viosId:"305518606",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"2 MG",size:"30ct",viosId:"305518604",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"2.5 MG",size:"30ct",viosId:"305521479",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"4 MG",size:"30ct",viosId:"305518610",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"5 MG",size:"30ct",viosId:"305518602",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"6 MG",size:"30ct",viosId:"305518611",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"8 MG",size:"30ct",viosId:"305518612",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"10 MG",size:"30ct",viosId:"305522977",basePrice:64.06,retailPrice:89.68},
  {name:"Semaglutide ODT",form:"Tab Disintegrating",strength:"12 MG",size:"30ct",viosId:"305522978",basePrice:64.06,retailPrice:89.68},
  // === GLP-1: Tirzepatide ODT ===
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"3 MG",size:"30ct",viosId:"305518649",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"4 MG",size:"30ct",viosId:"305518650",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"5 MG",size:"30ct",viosId:"305518648",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"6 MG",size:"30ct",viosId:"305518714",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"7 MG",size:"30ct",viosId:"305518715",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"8 MG",size:"30ct",viosId:"305518716",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"10 MG",size:"30ct",viosId:"305522974",basePrice:73.92,retailPrice:103.49},
  {name:"Tirzepatide ODT",form:"Tab Disintegrating",strength:"12 MG",size:"30ct",viosId:"305522976",basePrice:64.06,retailPrice:89.68},
  // === HORMONE: BIEST (20:80) Cream ===
  {name:"BIEST (20:80)",form:"Cream",strength:"1 MG/ML",size:"30g",viosId:"302906811",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (20:80)",form:"Cream",strength:"2.5 MG/ML",size:"30g",viosId:"302906817",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (20:80)",form:"Cream",strength:"5 MG/ML",size:"30g",viosId:"302906819",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (20:80)",form:"Cream",strength:"10 MG/ML",size:"30g",viosId:"302906814",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (20:80)",form:"Cream",strength:"1 MG/ML",size:"90g",viosId:"302906811",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (20:80)",form:"Cream",strength:"2.5 MG/ML",size:"90g",viosId:"302906817",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (20:80)",form:"Cream",strength:"5 MG/ML",size:"90g",viosId:"302906819",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (20:80)",form:"Cream",strength:"10 MG/ML",size:"90g",viosId:"302906814",basePrice:55.44,retailPrice:77.62},
  // === HORMONE: BIEST (20:80) Troche ===
  {name:"BIEST (20:80)",form:"Troche",strength:"1 MG",size:"30ct",viosId:"305470141",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (20:80)",form:"Troche",strength:"2.5 MG",size:"30ct",viosId:"305511658",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (20:80)",form:"Troche",strength:"5 MG",size:"30ct",viosId:"302905448",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (20:80)",form:"Troche",strength:"10 MG",size:"30ct",viosId:"304100216",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (20:80)",form:"Troche",strength:"1 MG",size:"90ct",viosId:"305470141",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (20:80)",form:"Troche",strength:"2.5 MG",size:"90ct",viosId:"305511658",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (20:80)",form:"Troche",strength:"5 MG",size:"90ct",viosId:"302905448",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (20:80)",form:"Troche",strength:"10 MG",size:"90ct",viosId:"304100216",basePrice:55.44,retailPrice:77.62},
  // === HORMONE: BIEST (50:50) Cream ===
  {name:"BIEST (50:50)",form:"Cream",strength:"1 MG/ML",size:"30g",viosId:"302906831",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (50:50)",form:"Cream",strength:"2.5 MG/ML",size:"30g",viosId:"302906839",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (50:50)",form:"Cream",strength:"5 MG/ML",size:"30g",viosId:"302906844",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (50:50)",form:"Cream",strength:"10 MG/ML",size:"30g",viosId:"302906834",basePrice:23.41,retailPrice:32.77},
  {name:"BIEST (50:50)",form:"Cream",strength:"1 MG/ML",size:"90g",viosId:"302906831",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (50:50)",form:"Cream",strength:"2.5 MG/ML",size:"90g",viosId:"302906839",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (50:50)",form:"Cream",strength:"5 MG/ML",size:"90g",viosId:"302906844",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (50:50)",form:"Cream",strength:"10 MG/ML",size:"90g",viosId:"302906834",basePrice:55.44,retailPrice:77.62},
  // === HORMONE: BIEST (50:50) Troche ===
  {name:"BIEST (50:50)",form:"Troche",strength:"1 MG",size:"30ct",viosId:"304099429",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (50:50)",form:"Troche",strength:"2.5 MG",size:"30ct",viosId:"305518949",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (50:50)",form:"Troche",strength:"5 MG",size:"30ct",viosId:"302905789",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (50:50)",form:"Troche",strength:"10 MG",size:"30ct",viosId:"305469933",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (50:50)",form:"Troche",strength:"1 MG",size:"90ct",viosId:"304099429",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (50:50)",form:"Troche",strength:"2.5 MG",size:"90ct",viosId:"305518949",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (50:50)",form:"Troche",strength:"5 MG",size:"90ct",viosId:"302905789",basePrice:55.44,retailPrice:77.62},
  {name:"BIEST (50:50)",form:"Troche",strength:"10 MG",size:"90ct",viosId:"305469933",basePrice:55.44,retailPrice:77.62},
  // === HORMONE: BIEST (50:50) RDT ===
  {name:"BIEST (50:50)",form:"RDT",strength:"1 MG",size:"30ct",viosId:"304993002",basePrice:24.64,retailPrice:34.50},
  {name:"BIEST (50:50)",form:"RDT",strength:"1 MG",size:"90ct",viosId:"304993002",basePrice:55.44,retailPrice:77.62},
  // === HORMONE: DHEA Cream ===
  {name:"DHEA",form:"Cream",strength:"25 MG/ML",size:"30g",viosId:"305790060",basePrice:49.28,retailPrice:68.99},
  {name:"DHEA",form:"Cream",strength:"50 MG/ML",size:"30g",viosId:"305757141",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: DHEA SR Capsule ===
  {name:"DHEA SR",form:"Capsule",strength:"40 MG",size:"30ct",viosId:"305808635",basePrice:24.64,retailPrice:34.50},
  {name:"DHEA SR",form:"Capsule",strength:"60 MG",size:"30ct",viosId:"305808636",basePrice:24.64,retailPrice:34.50},
  {name:"DHEA SR",form:"Capsule",strength:"80 MG",size:"30ct",viosId:"305808637",basePrice:24.64,retailPrice:34.50},
  {name:"DHEA SR",form:"Capsule",strength:"100 MG",size:"30ct",viosId:"305527582",basePrice:24.64,retailPrice:34.50},
  {name:"DHEA SR",form:"Capsule",strength:"40 MG",size:"90ct",viosId:"305808635",basePrice:68.99,retailPrice:96.59},
  {name:"DHEA SR",form:"Capsule",strength:"60 MG",size:"90ct",viosId:"305808636",basePrice:68.99,retailPrice:96.59},
  {name:"DHEA SR",form:"Capsule",strength:"80 MG",size:"90ct",viosId:"305808637",basePrice:68.99,retailPrice:96.59},
  {name:"DHEA SR",form:"Capsule",strength:"100 MG",size:"90ct",viosId:"305527582",basePrice:68.99,retailPrice:96.59},
  // === HORMONE: ESTRADIOL Cream ===
  {name:"ESTRADIOL",form:"Cream",strength:"0.1 MG/ML",size:"30g",viosId:"304097544",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRADIOL",form:"Cream",strength:"0.25 MG/ML",size:"30g",viosId:"305808638",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRADIOL",form:"Cream",strength:"0.5 MG/ML",size:"30g",viosId:"302904267",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRADIOL",form:"Cream",strength:"1 MG/ML",size:"30g",viosId:"302904268",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRADIOL",form:"Cream",strength:"2 MG/ML",size:"30g",viosId:"302904276",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRADIOL",form:"Cream",strength:"10 MG/ML",size:"30g",viosId:"305757726",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRADIOL",form:"Cream",strength:"0.1 MG/ML",size:"90g",viosId:"304097544",basePrice:73.92,retailPrice:103.49},
  {name:"ESTRADIOL",form:"Cream",strength:"0.5 MG/ML",size:"90g",viosId:"302904267",basePrice:73.92,retailPrice:103.49},
  {name:"ESTRADIOL",form:"Cream",strength:"1 MG/ML",size:"90g",viosId:"302904268",basePrice:73.92,retailPrice:103.49},
  {name:"ESTRADIOL",form:"Cream",strength:"2 MG/ML",size:"90g",viosId:"302904276",basePrice:73.92,retailPrice:103.49},
  {name:"ESTRADIOL",form:"Cream",strength:"10 MG/ML",size:"90g",viosId:"305757726",basePrice:73.92,retailPrice:103.49},
  // === HORMONE: ESTRADIOL IR Capsule ===
  {name:"ESTRADIOL IR",form:"Capsule",strength:"0.5 MG",size:"30ct",viosId:"305339507",basePrice:18.48,retailPrice:25.87},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"1 MG",size:"30ct",viosId:"305511462",basePrice:18.48,retailPrice:25.87},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"1.5 MG",size:"30ct",viosId:"302906707",basePrice:18.48,retailPrice:25.87},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"2 MG",size:"30ct",viosId:"304751418",basePrice:18.48,retailPrice:25.87},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"0.5 MG",size:"90ct",viosId:"305339507",basePrice:49.28,retailPrice:68.99},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"1 MG",size:"90ct",viosId:"305511462",basePrice:49.28,retailPrice:68.99},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"1.5 MG",size:"90ct",viosId:"302906707",basePrice:49.28,retailPrice:68.99},
  {name:"ESTRADIOL IR",form:"Capsule",strength:"2 MG",size:"90ct",viosId:"304751418",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: ESTRIOL Cream ===
  {name:"ESTRIOL",form:"Cream",strength:"0.5 MG/ML",size:"30g",viosId:"302906671",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRIOL",form:"Cream",strength:"1 MG/ML",size:"30g",viosId:"302906870",basePrice:24.64,retailPrice:34.50},
  {name:"ESTRIOL",form:"Cream",strength:"2 MG/ML",size:"30g",viosId:"302905127",basePrice:24.64,retailPrice:34.50},
  // === HORMONE: PROGESTERONE Cream ===
  {name:"PROGESTERONE",form:"Cream",strength:"10 MG/ML",size:"30g",viosId:"302904351",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Cream",strength:"25 MG/ML",size:"30g",viosId:"302904358",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Cream",strength:"50 MG/ML",size:"30g",viosId:"302904365",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Cream",strength:"100 MG/ML",size:"30g",viosId:"302904352",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Cream",strength:"200 MG/ML",size:"30g",viosId:"302904357",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Cream",strength:"300 MG/ML",size:"30g",viosId:"302904363",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Cream",strength:"10 MG/ML",size:"90g",viosId:"302904351",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Cream",strength:"25 MG/ML",size:"90g",viosId:"302904358",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Cream",strength:"50 MG/ML",size:"90g",viosId:"302904365",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Cream",strength:"100 MG/ML",size:"90g",viosId:"302904352",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Cream",strength:"200 MG/ML",size:"90g",viosId:"302904357",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Cream",strength:"300 MG/ML",size:"90g",viosId:"302904363",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: PROGESTERONE IR Capsule ===
  {name:"PROGESTERONE IR",form:"Capsule",strength:"25 MG",size:"30ct",viosId:"302905711",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"50 MG",size:"30ct",viosId:"302903947",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"75 MG",size:"30ct",viosId:"302903949",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"100 MG",size:"30ct",viosId:"302903934",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"200 MG",size:"30ct",viosId:"302903941",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"300 MG",size:"30ct",viosId:"302903945",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"25 MG",size:"90ct",viosId:"302905711",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"50 MG",size:"90ct",viosId:"302903947",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"75 MG",size:"90ct",viosId:"302903949",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"100 MG",size:"90ct",viosId:"302903934",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"200 MG",size:"90ct",viosId:"302903941",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE IR",form:"Capsule",strength:"300 MG",size:"90ct",viosId:"302903945",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: PROGESTERONE SR Capsule ===
  {name:"PROGESTERONE SR",form:"Capsule",strength:"25 MG",size:"30ct",viosId:"302903975",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"50 MG",size:"30ct",viosId:"302903982",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"75 MG",size:"30ct",viosId:"302904000",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"100 MG",size:"30ct",viosId:"302903955",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"200 MG",size:"30ct",viosId:"302903971",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"300 MG",size:"30ct",viosId:"302903978",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"25 MG",size:"90ct",viosId:"302903975",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"50 MG",size:"90ct",viosId:"302903982",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"75 MG",size:"90ct",viosId:"302904000",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"100 MG",size:"90ct",viosId:"302903955",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"200 MG",size:"90ct",viosId:"302903971",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE SR",form:"Capsule",strength:"300 MG",size:"90ct",viosId:"302903978",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: PROGESTERONE Troche ===
  {name:"PROGESTERONE",form:"Troche",strength:"25 MG",size:"30ct",viosId:"302904814",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Troche",strength:"50 MG",size:"30ct",viosId:"302904458",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Troche",strength:"75 MG",size:"30ct",viosId:"305515778",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Troche",strength:"100 MG",size:"30ct",viosId:"302904459",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Troche",strength:"200 MG",size:"30ct",viosId:"302904456",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Troche",strength:"300 MG",size:"30ct",viosId:"302904578",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"Troche",strength:"25 MG",size:"90ct",viosId:"302904814",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Troche",strength:"50 MG",size:"90ct",viosId:"302904458",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Troche",strength:"75 MG",size:"90ct",viosId:"305515778",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Troche",strength:"100 MG",size:"90ct",viosId:"302904459",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Troche",strength:"200 MG",size:"90ct",viosId:"302904456",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"Troche",strength:"300 MG",size:"90ct",viosId:"302904578",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: PROGESTERONE RDT ===
  {name:"PROGESTERONE",form:"RDT",strength:"50 MG",size:"30ct",viosId:"305518459",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"RDT",strength:"100 MG",size:"30ct",viosId:"305513965",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"RDT",strength:"200 MG",size:"30ct",viosId:"305525079",basePrice:19.71,retailPrice:27.59},
  {name:"PROGESTERONE",form:"RDT",strength:"50 MG",size:"90ct",viosId:"305518459",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"RDT",strength:"100 MG",size:"90ct",viosId:"305513965",basePrice:49.28,retailPrice:68.99},
  {name:"PROGESTERONE",form:"RDT",strength:"200 MG",size:"90ct",viosId:"305525079",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: TESTOSTERONE Cream ===
  {name:"TESTOSTERONE",form:"Cream",strength:"10 MG/ML",size:"30g",viosId:"302904380",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Cream",strength:"20 MG/ML",size:"30g",viosId:"302904401",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Cream",strength:"50 MG/ML",size:"30g",viosId:"302904424",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Cream",strength:"100 MG/ML",size:"30g",viosId:"302904216",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Cream",strength:"150 MG/ML",size:"30g",viosId:"302904393",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Cream",strength:"200 MG/ML",size:"30g",viosId:"302904402",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Cream",strength:"10 MG/ML",size:"90g",viosId:"302904380",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Cream",strength:"20 MG/ML",size:"90g",viosId:"302904401",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Cream",strength:"50 MG/ML",size:"90g",viosId:"302904424",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Cream",strength:"100 MG/ML",size:"90g",viosId:"302904216",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Cream",strength:"150 MG/ML",size:"90g",viosId:"302904393",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Cream",strength:"200 MG/ML",size:"90g",viosId:"302904402",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: TESTOSTERONE Troche ===
  {name:"TESTOSTERONE",form:"Troche",strength:"10 MG",size:"30ct",viosId:"302904855",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Troche",strength:"20 MG",size:"30ct",viosId:"302905802",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Troche",strength:"50 MG",size:"30ct",viosId:"302904486",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Troche",strength:"100 MG",size:"30ct",viosId:"305516069",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Troche",strength:"150 MG",size:"30ct",viosId:"302904471",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Troche",strength:"200 MG",size:"30ct",viosId:"302904478",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"Troche",strength:"10 MG",size:"90ct",viosId:"302904855",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Troche",strength:"20 MG",size:"90ct",viosId:"302905802",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Troche",strength:"50 MG",size:"90ct",viosId:"302904486",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Troche",strength:"100 MG",size:"90ct",viosId:"305516069",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Troche",strength:"150 MG",size:"90ct",viosId:"302904471",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"Troche",strength:"200 MG",size:"90ct",viosId:"302904478",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: TESTOSTERONE RDT ===
  {name:"TESTOSTERONE",form:"RDT",strength:"10 MG",size:"30ct",viosId:"305758056",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"RDT",strength:"50 MG",size:"30ct",viosId:"305530134",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"RDT",strength:"200 MG",size:"30ct",viosId:"305492173",basePrice:19.71,retailPrice:27.59},
  {name:"TESTOSTERONE",form:"RDT",strength:"10 MG",size:"90ct",viosId:"305758056",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"RDT",strength:"50 MG",size:"90ct",viosId:"305530134",basePrice:49.28,retailPrice:68.99},
  {name:"TESTOSTERONE",form:"RDT",strength:"200 MG",size:"90ct",viosId:"305492173",basePrice:49.28,retailPrice:68.99},
  // === HORMONE: Testosterone Cypionate GSO ===
  {name:"Testosterone Cypionate GSO",form:"Oil Inj Soln",strength:"25mg/mL",size:"5mL",viosId:"305511463",basePrice:24.64,retailPrice:34.50},
  {name:"Testosterone Cypionate GSO",form:"Oil Inj Soln",strength:"200mg/mL",size:"5mL",viosId:"304100580",basePrice:24.64,retailPrice:34.50},
  {name:"Testosterone Cypionate GSO",form:"Oil Inj Soln",strength:"200mg/mL",size:"10mL",viosId:"305511459",basePrice:30.80,retailPrice:43.12},
  // === HORMONE: Testosterone Enanthate ===
  {name:"Testosterone Enanthate",form:"Oil Inj Soln",strength:"200mg/mL",size:"5mL",viosId:"304992809",basePrice:24.64,retailPrice:34.50},
  // === HORMONE: PREGNENOLONE IR ===
  {name:"PREGNENOLONE IR",form:"Capsule",strength:"50 MG",size:"30ct",viosId:"302905216",basePrice:28.34,retailPrice:39.68},
  {name:"PREGNENOLONE IR",form:"Capsule",strength:"100 MG",size:"30ct",viosId:"302905290",basePrice:28.34,retailPrice:39.68},
  // === HORMONE: OXYTOCIN ===
  {name:"OXYTOCIN",form:"Nasal Spray",strength:"50 IU/ML",size:"15mL",viosId:"304098103",basePrice:61.60,retailPrice:86.24},
  {name:"OXYTOCIN",form:"Troche",strength:"15 UNIT",size:"30ct",viosId:"302904454",basePrice:30.80,retailPrice:43.12},
  {name:"OXYTOCIN",form:"Troche",strength:"25 UNIT",size:"30ct",viosId:"305808654",basePrice:30.80,retailPrice:43.12},
  {name:"OXYTOCIN",form:"Troche",strength:"40 UNIT",size:"30ct",viosId:"305808655",basePrice:30.80,retailPrice:43.12},
  // === HORMONE: NANDROLONE DECANOATE ===
  {name:"NANDROLONE DECANOATE",form:"Oil Inj Soln",strength:"200 MG/ML",size:"5mL",viosId:"305471991",basePrice:61.60,retailPrice:86.24},
  // === HORMONE: NALTREXONE ===
  {name:"NALTREXONE",form:"Capsule",strength:"1.5 MG",size:"30ct",viosId:"302903913",basePrice:23.41,retailPrice:32.77},
  {name:"NALTREXONE",form:"Capsule",strength:"3 MG",size:"30ct",viosId:"302903915",basePrice:23.41,retailPrice:32.77},
  {name:"NALTREXONE",form:"Capsule",strength:"4.5 MG",size:"30ct",viosId:"302903917",basePrice:23.41,retailPrice:32.77},
  {name:"NALTREXONE",form:"Capsule",strength:"1.5 MG",size:"90ct",viosId:"302903913",basePrice:64.06,retailPrice:89.68},
  {name:"NALTREXONE",form:"Capsule",strength:"3 MG",size:"90ct",viosId:"302903915",basePrice:64.06,retailPrice:89.68},
  {name:"NALTREXONE",form:"Capsule",strength:"4.5 MG",size:"90ct",viosId:"302903917",basePrice:64.06,retailPrice:89.68},
  // === SEXUAL HEALTH: TADALAFIL Capsule ===
  {name:"TADALAFIL",form:"Capsule",strength:"7.5 MG",size:"30ct",viosId:"302904688",basePrice:19.71,retailPrice:27.59},
  // === SEXUAL HEALTH: TADALAFIL Troche ===
  {name:"TADALAFIL",form:"Troche",strength:"5 MG",size:"15ct",viosId:"302905056",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"Troche",strength:"10 MG",size:"15ct",viosId:"302905173",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"Troche",strength:"20 MG",size:"15ct",viosId:"302904463",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"Troche",strength:"50 MG",size:"15ct",viosId:"302904651",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"Troche",strength:"5 MG",size:"30ct",viosId:"302905056",basePrice:24.64,retailPrice:34.50},
  {name:"TADALAFIL",form:"Troche",strength:"10 MG",size:"30ct",viosId:"302905173",basePrice:24.64,retailPrice:34.50},
  {name:"TADALAFIL",form:"Troche",strength:"20 MG",size:"30ct",viosId:"302904463",basePrice:24.64,retailPrice:34.50},
  {name:"TADALAFIL",form:"Troche",strength:"50 MG",size:"30ct",viosId:"302904651",basePrice:24.64,retailPrice:34.50},
  // === SEXUAL HEALTH: TADALAFIL RDT ===
  {name:"TADALAFIL",form:"RDT",strength:"5 MG",size:"15ct",viosId:"302904725",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"RDT",strength:"10 MG",size:"15ct",viosId:"302904808",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"RDT",strength:"20 MG",size:"15ct",viosId:"302905501",basePrice:18.48,retailPrice:25.87},
  {name:"TADALAFIL",form:"RDT",strength:"5 MG",size:"30ct",viosId:"302904725",basePrice:24.64,retailPrice:34.50},
  {name:"TADALAFIL",form:"RDT",strength:"10 MG",size:"30ct",viosId:"302904808",basePrice:24.64,retailPrice:34.50},
  {name:"TADALAFIL",form:"RDT",strength:"20 MG",size:"30ct",viosId:"302905501",basePrice:24.64,retailPrice:34.50},
  // === SEXUAL HEALTH: SILDENAFIL CITRATE Troche ===
  {name:"SILDENAFIL CITRATE",form:"Troche",strength:"50 MG",size:"15ct",viosId:"302904600",basePrice:22.18,retailPrice:31.05},
  {name:"SILDENAFIL CITRATE",form:"Troche",strength:"100 MG",size:"15ct",viosId:"302904460",basePrice:22.18,retailPrice:31.05},
  {name:"SILDENAFIL CITRATE",form:"Troche",strength:"50 MG",size:"30ct",viosId:"302904600",basePrice:30.80,retailPrice:43.12},
  {name:"SILDENAFIL CITRATE",form:"Troche",strength:"100 MG",size:"30ct",viosId:"302904460",basePrice:30.80,retailPrice:43.12},
  {name:"SILDENAFIL CITRATE",form:"Troche",strength:"100 MG",size:"30ct",viosId:"302905672",basePrice:30.80,retailPrice:43.12},
  // === SEXUAL HEALTH: SILDENAFIL RDT ===
  {name:"SILDENAFIL CITRATE",form:"RDT",strength:"100 MG",size:"15ct",viosId:"302905672",basePrice:22.18,retailPrice:31.05},
  // === SEXUAL HEALTH: ENCLOMIPHENE CITRATE ===
  {name:"ENCLOMIPHENE CITRATE",form:"Capsule",strength:"12.5 MG",size:"30ct",viosId:"303902818",basePrice:33.26,retailPrice:46.56},
  {name:"ENCLOMIPHENE CITRATE",form:"Capsule",strength:"25 MG",size:"30ct",viosId:"304449768",basePrice:36.96,retailPrice:51.74},
  {name:"ENCLOMIPHENE CITRATE",form:"Capsule",strength:"12.5 MG",size:"90ct",viosId:"303902818",basePrice:98.56,retailPrice:137.98},
  {name:"ENCLOMIPHENE CITRATE",form:"Capsule",strength:"25 MG",size:"90ct",viosId:"304449768",basePrice:110.88,retailPrice:155.23},
  // === SEXUAL HEALTH: CLOMIPHENE CITRATE ===
  {name:"CLOMIPHENE CITRATE",form:"Capsule",strength:"25 MG",size:"30ct",viosId:"305313670",basePrice:19.71,retailPrice:27.59},
  {name:"CLOMIPHENE CITRATE",form:"Capsule",strength:"25 MG",size:"90ct",viosId:"305313670",basePrice:55.44,retailPrice:77.62},
  {name:"CLOMIPHENE CITRATE",form:"Capsule",strength:"50 MG",size:"30ct",viosId:"305313669",basePrice:24.64,retailPrice:34.50},
  {name:"CLOMIPHENE CITRATE",form:"Capsule",strength:"50 MG",size:"90ct",viosId:"305313669",basePrice:55.44,retailPrice:77.62},
  // === SEXUAL HEALTH: GONADORELIN ===
  {name:"GONADORELIN",form:"Injectable",strength:"1MG/ML",size:"5mL",viosId:"305518501",basePrice:55.44,retailPrice:77.62},
  // === ANTI-AGING: GHK-CU ===
  {name:"GHK-CU",form:"Cream",strength:"0.10%",size:"30g",viosId:"305808641",basePrice:49.28,retailPrice:68.99},
  // === ANTI-AGING: HYDROQUINONE ===
  {name:"HYDROQUINONE",form:"Cream",strength:"6%",size:"30g",viosId:"305808642",basePrice:49.28,retailPrice:68.99},
  {name:"HYDROQUINONE",form:"Cream",strength:"8%",size:"30g",viosId:"305808643",basePrice:49.28,retailPrice:68.99},
  {name:"HYDROQUINONE",form:"Cream",strength:"10%",size:"30g",viosId:"304992740",basePrice:49.28,retailPrice:68.99},
  // === ANTI-AGING: TRETINOIN ===
  {name:"TRETINOIN",form:"Cream",strength:"0.05%",size:"30g",viosId:"305808664",basePrice:50.51,retailPrice:70.71},
  {name:"TRETINOIN",form:"Cream",strength:"0.15%",size:"30g",viosId:"305781734",basePrice:50.51,retailPrice:70.71},
  // === ANTI-AGING: Methylene Blue ===
  {name:"Methylene Blue",form:"Capsule",strength:"10 MG",size:"30ct",viosId:"305746199",basePrice:109.65,retailPrice:153.51},
  {name:"Methylene Blue",form:"Capsule",strength:"25 MG",size:"30ct",viosId:"305528226",basePrice:109.65,retailPrice:153.51},
  {name:"Methylene Blue",form:"Capsule",strength:"50 MG",size:"30ct",viosId:"305521478",basePrice:109.65,retailPrice:153.51},
  // === ANTI-AGING: NAD+ Injectable ===
  {name:"NAD+",form:"Inj Sol",strength:"200 MG/ML",size:"5mL",viosId:"305471994",basePrice:61.60,retailPrice:86.24},
  // === ANTI-AGING: NAD+ Troche ===
  {name:"NAD+",form:"Troche",strength:"200 MG",size:"15ct",viosId:"305757227",basePrice:30.80,retailPrice:43.12},
  // === PEPTIDES: SERMORELIN ===
  {name:"SERMORELIN",form:"Inj Sol",strength:"3MG/ML",size:"5mL",viosId:"305511461",basePrice:55.44,retailPrice:77.62},
  // === VITAMINS: Glutathione ===
  {name:"Glutathione",form:"Injectable",strength:"200mg/mL",size:"10mL",viosId:"305511460",basePrice:24.64,retailPrice:34.50},
  // === VITAMINS: Methylcobalamin ===
  {name:"Methylcobalamin",form:"Injectable",strength:"1mg/mL",size:"5mL",viosId:"305516130",basePrice:24.64,retailPrice:34.50},
  {name:"Methylcobalamin",form:"Inj Sol",strength:"1mg/ml",size:"10mL",viosId:"305516130",basePrice:24.64,retailPrice:34.50},
  // === VITAMINS: ASCORBIC ACID combo ===
  {name:"ASCORBIC ACID/ALOE/ESTRIOL/SODIUM HYALURONATE",form:"Cream",strength:"0.3%/0.5%/1%/0.5%",size:"30g",viosId:"305801236",basePrice:45.58,retailPrice:63.81},
  // === VITAMINS: MIC-B12 ===
  {name:"MIC-B12",form:"Injectable",strength:"25/50/50/1 MG/ML",size:"5mL",viosId:"305492059",basePrice:61.60,retailPrice:86.24},
  // === HAIR: Finasteride ===
  {name:"Finasteride",form:"Tablet",strength:"1mg",size:"30ct",viosId:"302414144",basePrice:9.24,retailPrice:12.94},
  {name:"Finasteride",form:"Tablet",strength:"1mg",size:"90ct",viosId:"302414144",basePrice:13.55,retailPrice:18.97},
  // === HAIR: MINOXIDIL ===
  {name:"MINOXIDIL",form:"Solution",strength:"5%",size:"60mL",viosId:"305808652",basePrice:44.35,retailPrice:62.09},
  // === HAIR: FINASTERIDE/MINOXIDIL ===
  {name:"FINASTERIDE/MINOXIDIL",form:"Solution",strength:"0.1/5 %",size:"60mL",viosId:"305470014",basePrice:44.35,retailPrice:62.09},
  {name:"FINASTERIDE/MINOXIDIL",form:"Solution",strength:"0.1/10 %",size:"60mL",viosId:"305746484",basePrice:44.35,retailPrice:62.09},
  // === THYROID: LIOTHYRONINE (T3) IR ===
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"1 MCG",size:"30ct",viosId:"305808645",basePrice:28.34,retailPrice:39.68},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"5 MCG",size:"90ct",viosId:"305757161",basePrice:72.69,retailPrice:101.77},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"10 MCG",size:"30ct",viosId:"305781430",basePrice:28.34,retailPrice:39.68},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"25 MCG",size:"30ct",viosId:"305808646",basePrice:28.34,retailPrice:39.68},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"75 MCG",size:"30ct",viosId:"305808647",basePrice:28.34,retailPrice:39.68},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"100 MCG",size:"30ct",viosId:"305808648",basePrice:28.34,retailPrice:39.68},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"1 MCG",size:"90ct",viosId:"305808645",basePrice:72.69,retailPrice:101.77},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"10 MCG",size:"90ct",viosId:"305781430",basePrice:72.69,retailPrice:101.77},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"25 MCG",size:"90ct",viosId:"305808646",basePrice:72.69,retailPrice:101.77},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"75 MCG",size:"90ct",viosId:"305808647",basePrice:72.69,retailPrice:101.77},
  {name:"LIOTHYRONINE (T3) IR",form:"Capsule",strength:"100 MCG",size:"90ct",viosId:"305808648",basePrice:72.69,retailPrice:101.77},
  // === THYROID: LIOTHYRONINE (T3) SR ===
  {name:"LIOTHYRONINE (T3) SR",form:"Capsule",strength:"5 MCG",size:"90ct",viosId:"302903898",basePrice:72.69,retailPrice:101.77},
  {name:"LIOTHYRONINE (T3) SR",form:"Capsule",strength:"25 MCG",size:"90ct",viosId:"302905372",basePrice:72.69,retailPrice:101.77},
  // === THYROID: LEVOTHYROXINE ===
  {name:"LEVOTHYROXINE",form:"Capsule",strength:"50 MCG",size:"30ct",viosId:"302906753",basePrice:28.34,retailPrice:39.68},
  {name:"LEVOTHYROXINE",form:"Capsule",strength:"75 MCG",size:"30ct",viosId:"302906754",basePrice:28.34,retailPrice:39.68},
  {name:"LEVOTHYROXINE",form:"Capsule",strength:"100 MCG",size:"30ct",viosId:"302905077",basePrice:28.34,retailPrice:39.68},
  {name:"LEVOTHYROXINE",form:"Capsule",strength:"125 MCG",size:"30ct",viosId:"305808644",basePrice:28.34,retailPrice:39.68},
  {name:"LEVOTHYROXINE",form:"Capsule",strength:"150 MCG",size:"30ct",viosId:"305339483",basePrice:28.34,retailPrice:39.68},
  // === THYROID: T4/T3 (BIOTHYROID) ===
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"9.5/2.25 MCG",size:"30ct",viosId:"305808661",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"19/4.5 MCG",size:"30ct",viosId:"302905325",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"38/9 MCG",size:"30ct",viosId:"302905373",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"75/5 MCG",size:"30ct",viosId:"305501599",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"75/7.5 MCG",size:"30ct",viosId:"305808658",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"76/18 MCG",size:"30ct",viosId:"302905471",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"100/10 MCG",size:"30ct",viosId:"302906286",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"100/15 MCG",size:"30ct",viosId:"302906322",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"100/25 MCG",size:"30ct",viosId:"302904046",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"114/27 MCG",size:"30ct",viosId:"302905341",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"190/45 MCG",size:"30ct",viosId:"305808659",basePrice:29.57,retailPrice:41.40},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"9.5/2.25 MCG",size:"90ct",viosId:"305808661",basePrice:72.69,retailPrice:101.77},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"19/4.5 MCG",size:"90ct",viosId:"302905325",basePrice:72.69,retailPrice:101.77},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"38/9 MCG",size:"90ct",viosId:"302905373",basePrice:72.69,retailPrice:101.77},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"76/18 MCG",size:"90ct",viosId:"302905471",basePrice:72.69,retailPrice:101.77},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"114/27 MCG",size:"90ct",viosId:"302905341",basePrice:72.69,retailPrice:101.77},
  {name:"T4/T3 (BIOTHYROID)",form:"Capsule",strength:"190/45 MCG",size:"90ct",viosId:"305808659",basePrice:72.69,retailPrice:101.77},
];

// Map product name to product_type_id
function getProductTypeId(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("SEMAGLUTIDE") || n.includes("TIRZEPATIDE")) return PT.GLP1;
  if (n.includes("BIEST") || n.includes("DHEA") || n.includes("ESTRADIOL") || n.includes("ESTRIOL") ||
      n.includes("PROGESTERONE") || n.includes("TESTOSTERONE") || n.includes("PREGNENOLONE") ||
      n.includes("OXYTOCIN") || n.includes("NANDROLONE") || n.includes("NALTREXONE")) return PT.HORMONE;
  if (n.includes("LIOTHYRONINE") || n.includes("LEVOTHYROXINE") || n.includes("BIOTHYROID") || n.includes("T4/T3")) return PT.THYROID;
  if (n.includes("TADALAFIL") || n.includes("SILDENAFIL") || n.includes("ENCLOMIPHENE") || n.includes("CLOMIPHENE") || n.includes("GONADORELIN")) return PT.SEXUAL;
  if (n.includes("FINASTERIDE") || n.includes("MINOXIDIL")) return PT.HAIR;
  if (n.includes("GHK") || n.includes("HYDROQUINONE") || n.includes("TRETINOIN") || n.includes("METHYLENE") || n.includes("NAD+")) return PT.ANTIAGING;
  if (n.includes("SERMORELIN")) return PT.PEPTIDES;
  if (n.includes("GLUTATHIONE") || n.includes("METHYLCOBALAMIN") || n.includes("MIC") || n.includes("ASCORBIC")) return PT.VITAMINS;
  return PT.HORMONE; // fallback
}

function isGlp1(name: string): boolean {
  const n = name.toUpperCase();
  return n.includes("SEMAGLUTIDE") || n.includes("TIRZEPATIDE");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Group raw data into product families by name+form
    const familyMap = new Map<string, RawRow[]>();
    const seen = new Set<string>(); // dedup key: name+form+strength+size

    for (const row of RAW_DATA) {
      const dedupKey = `${row.name}|${row.form}|${row.strength}|${row.size}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const familyKey = `${row.name}|||${row.form}`;
      if (!familyMap.has(familyKey)) familyMap.set(familyKey, []);
      familyMap.get(familyKey)!.push(row);
    }

    // Check which base names have multiple forms (need disambiguation)
    const nameFormCount = new Map<string, number>();
    for (const [key] of familyMap) {
      const baseName = key.split("|||")[0];
      nameFormCount.set(baseName, (nameFormCount.get(baseName) || 0) + 1);
    }

    console.log(`Grouped into ${familyMap.size} product families from ${seen.size} unique variants`);

    let productsCreated = 0;
    let variantsCreated = 0;
    let pharmacyLinksCreated = 0;

    for (const [familyKey, variants] of familyMap) {
      const first = variants[0];
      const baseName = familyKey.split("|||")[0];
      const hasMultipleForms = (nameFormCount.get(baseName) || 0) > 1;
      
      // Append form to name if same product name has multiple dosage forms
      const productName = hasMultipleForms ? `${first.name} (${first.form})` : first.name;
      
      // Insert product - set vios_lf_product_id from first variant to satisfy trigger
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          name: productName,
          dosage_form: first.form,
          requires_prescription: true,
          is_glp1: isGlp1(first.name),
          product_type_id: getProductTypeId(first.name),
          base_price: first.basePrice,
          retail_price: first.retailPrice,
          active: true,
          vios_lf_product_id: first.viosId,
        })
        .select("id")
        .single();

      if (productError) {
        console.error(`Failed to create product ${first.name} ${first.form}:`, productError);
        continue;
      }
      productsCreated++;

      // Insert all variants
      const variantRecords = variants.map((v, idx) => ({
        product_id: product.id,
        dosage_label: `${v.strength} - ${v.size}`,
        base_price: v.basePrice,
        retail_price: v.retailPrice,
        product_code: v.viosId,
        active: true,
        sort_order: idx,
      }));

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert(variantRecords);

      if (variantError) {
        console.error(`Failed to create variants for ${first.name}:`, variantError);
      } else {
        variantsCreated += variantRecords.length;
      }

      // Link to Vios pharmacy
      const { error: pharmacyError } = await supabase
        .from("product_pharmacies")
        .insert({
          product_id: product.id,
          pharmacy_id: VIOS_PHARMACY_ID,
        });

      if (pharmacyError) {
        console.error(`Failed to link pharmacy for ${first.name}:`, pharmacyError);
      } else {
        pharmacyLinksCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        productsCreated,
        variantsCreated,
        pharmacyLinksCreated,
        familyCount: familyMap.size,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
