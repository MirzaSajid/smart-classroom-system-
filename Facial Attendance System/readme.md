Project Requirements:

1. Install cmake for windows or mac. (cmake is software)
2. Install dlib => pip install dlib
3. Install face_recognition => pip install face_recognition
4. Install opencv-python => pip install opencv-python
5. First tr to run it with virtual environment maybe you will not need to install packages.
6. To run virtual envirnment, command is: attendance_system\Scripts\activate

Project Flow:
1) Store the students images in images folder in the format: rollno_name like 017_ukasha.
2) Run the program.py file.
3) It will generated encodings for all the students in the images folder for first time and will save those encodings to backup file named face_encodings.pkl then the camera will open.
4) After camera is opened it will detect faces and mark students based on the data provided in the images.
5) On pressing q it will close the program and will store the attendance in an excel file.
6) The purpose of backup file is to optimize performance so that it don't genrate encodings everytime and also there is already logic added if there is a new student it will detect it and craete encoding for that and store into file and if we dlete some student then it will be dleted from file too meqans it is well managed here.
