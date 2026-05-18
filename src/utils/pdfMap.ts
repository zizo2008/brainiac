export const gdrivePdfMap: Record<string, string> = {
  chem: '1PpRY8g6GUrcjKzeK4BVlEHsPkJiEICA4',
  phy: '1dLMYwdVyTG4ZmKEBhsUjSlSOQuQoPxuy',
  bio: '1YY3kWeyIc9R5WZcUw_qnV4TD0rAayCMG',
  econ: '1mUpc-xeRzO14lcyR3jMapt1IrslfCqfB',
  econal: '12c7vXIZIaWi4-BsGJSgAwbJLEF8U5YFA',
  accal: '1BAUq4AhC57AKPgNSWN5bv0QtWq3fBF4k',
  accol: '1lfjWVlFHD-ygbn-7XJh9AQLB3kzvRN8u',
  chemcr: '1Q8Hkh8r2MmoyyKUdf_uCGEVLWWcLBZzE',
  chemal: '1tPHFirzrpVU25lqr3bMisKg5yNxTGal-',
  phycr: '1fp5GFsZWqxtF1yRLT_epnryJmxC4XYnN',
  phyal: '1Ax-u3YPkyzOoabXk_ZurxvROkx8nhSW2',
  biocr: '1XEIAM2teBbPa932R-CvgpBLs2gkfkvrJ',
  bioal: '1cIX4Lb6Ze9f-S1RxU8iGXuXQEc5g_Cfv'
};

export const getPdfUrl = (fileName: string) => {
  const id = gdrivePdfMap[fileName];
  if (!id) return `/${fileName}.pdf`; // fallback
  return `/gdrive/${id}`;
};
