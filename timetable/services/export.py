import io
import pandas as pd
from django.http import HttpResponse

def generate_scheme_template():
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for i in range(1, 9):
            sem_name = f'Sem {i}'
            df = pd.DataFrame(columns=[
                'Sr. No.', 'Course Type', 'Course Code', 'Course Name', 
                'L', 'T', 'P', 'Credits'
            ])
            
            # Add sample rows only to first semester to guide the user
            if i == 1:
                df.loc[0] = [1, 'PCC', 'CI04', 'Computer Network', 2, 1, 0, 3]
                df.loc[1] = [2, 'LC', 'CI04(P)', 'Computer Network Lab', 0, 0, 2, 1]
            
            df.to_excel(writer, index=False, sheet_name=sem_name)
        
    output.seek(0)
    return output

def download_scheme_template(request):
    excel_file = generate_scheme_template()
    response = HttpResponse(excel_file.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename=University_Scheme_Template.xlsx'
    return response

def generate_faculty_template():
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df = pd.DataFrame(columns=[
            'Faculty Name', 'Short Code', 'Designation', 'Max Lectures Per Day', 'Max Lectures Per Week'
        ])
        
        # Add sample row
        df.loc[0] = ['Yogendra Pal', 'YP', 'Asst. Prof.', 4, 20]
        df.loc[1] = ['Dr. Arpan Vyas', 'AV', 'Professor', 4, 18]
        
        df.to_excel(writer, index=False, sheet_name='Faculty List')
        
    output.seek(0)
    return output

def download_faculty_template_excel(request):
    excel_file = generate_faculty_template()
    response = HttpResponse(excel_file.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename=Faculty_Upload_Template.xlsx'
    return response
