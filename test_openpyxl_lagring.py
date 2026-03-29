from openpyxl import load_workbook

EXCEL_FIL = "Ordliste_Norsk_ny.xlsx"
wb = load_workbook(EXCEL_FIL)
wb.save("Ordliste_Norsk_ny_test.xlsx")
print("Ferdig! Prøv å åpne Ordliste_Norsk_ny_test.xlsx i Excel.")
