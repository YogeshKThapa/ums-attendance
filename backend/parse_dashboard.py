from bs4 import BeautifulSoup

with open("result_page.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

data = {}

# Extract Student Details
data['student_name'] = soup.find('label', id='lblStudentName').text.strip()
data['father_name'] = soup.find('label', id='lblFatherName').text.strip()
data['course_name'] = soup.find('label', id='CourseName').text.strip()
data['branch_name'] = soup.find('label', id='BranchName').text.strip()

# Extract Hidden Fields
hidden_ids = ['hdnCollegeId', 'hdnBranchId', 'hdnCourseId', 'hdnStudentAdmissionId']
for hid in hidden_ids:
    tag = soup.find('input', id=hid)
    if tag:
        data[hid] = tag.get('value')

print(data)
