<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Ensure students table has required columns (idempotent)
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        roll_no VARCHAR(50) DEFAULT '',
        class VARCHAR(50) DEFAULT '',
        year VARCHAR(10) DEFAULT '',
        division VARCHAR(10) DEFAULT '',
        class_name VARCHAR(100) DEFAULT '',
        section VARCHAR(50) DEFAULT '',
        department VARCHAR(100) DEFAULT '',
        image_data MEDIUMTEXT NULL,
        photo_folder_path VARCHAR(255) DEFAULT '',
        face_encoding MEDIUMTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_roll_no (roll_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    // Create teacher_activities table for activity logging
    $pdo->exec("CREATE TABLE IF NOT EXISTS teacher_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT DEFAULT 1,
        activity_type VARCHAR(50) NOT NULL,
        activity_description TEXT NOT NULL,
        student_name VARCHAR(255) DEFAULT NULL,
        department VARCHAR(100) DEFAULT NULL,
        year VARCHAR(10) DEFAULT NULL,
        division VARCHAR(10) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_teacher (teacher_id),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // add columns if they don't exist
    $cols = ["photo_folder_path VARCHAR(255) DEFAULT ''", "face_encoding MEDIUMTEXT", "class VARCHAR(50) DEFAULT ''", "year VARCHAR(10) DEFAULT ''", "division VARCHAR(10) DEFAULT ''"];
    foreach ($cols as $def) {
        try { $pdo->exec("ALTER TABLE students ADD COLUMN $def"); } catch(Exception $e) { /* ignore */ }
    }
    // Add unique constraint on roll_no if it doesn't exist
    try { $pdo->exec("ALTER TABLE students ADD UNIQUE KEY unique_roll_no (roll_no)"); } catch(Exception $e) { /* ignore if already exists */ }
} catch (Exception $e) { /* ignore */ }

switch($method) {
    case 'GET':
        // Check if requesting activities
        if(isset($_GET['activities'])){
            // Get recent activities
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
            // Use direct query with sanitized int for LIMIT (PDO doesn't allow LIMIT with bound params in some versions)
            $stmt = $pdo->query("SELECT * FROM teacher_activities ORDER BY created_at DESC LIMIT $limit");
            $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($activities);
        } else {
            // Get all students
            $stmt = $pdo->query("SELECT id, name, email, phone, roll_no, class, year, division, class_name, section, department, photo_folder_path, created_at FROM students ORDER BY created_at DESC");
            $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($students);
        }
        break;
        
    case 'POST':
        // Add new student (supports JSON and multipart)
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($ct, 'multipart/form-data') !== false) {
            // multipart path
            $name = $_POST['name'] ?? '';
            $class = $_POST['class'] ?? ($_POST['class_name'] ?? '');
            $year = $_POST['year'] ?? '';
            $division = $_POST['division'] ?? '';
            $roll = $_POST['roll_no'] ?? '';
            $department = $_POST['department'] ?? '';
            $email = $_POST['email'] ?? '';
            $phone = $_POST['phone'] ?? '';
            if(!$name || !$class || !$year || !$division){ echo json_encode(['success'=>false,'error'=>'Missing required fields']); break; }
            $stmt = $pdo->prepare("INSERT INTO students (name, email, phone, roll_no, class, year, division, department, photo_folder_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')");
            try {
                $ok = $stmt->execute([$name,$email,$phone,$roll,$class,$year,$division,$department]);
                if(!$ok){ echo json_encode(['success'=>false,'error'=>'Failed to add student']); break; }
            } catch(PDOException $e) {
                if($e->getCode() == 23000) { // Duplicate entry error
                    echo json_encode(['success'=>false,'error'=>'Student ID already exists. Please use a different ID.']);
                } else {
                    echo json_encode(['success'=>false,'error'=>'Failed to add student: ' . $e->getMessage()]);
                }
                break;
            }
            $sid = $pdo->lastInsertId();
            
            // Use exact student name for folder (keep spaces, remove only dangerous characters)
            $safeName = preg_replace('/[^A-Za-z0-9\- ]+/', '', $name);
            $safeName = trim($safeName);
            // Keep spaces, just normalize multiple spaces to single space
            $safeName = preg_replace('/\s+/', ' ', $safeName);
            if($safeName === '') $safeName = 'student_'.$sid;
            
            // Hierarchical folder structure: Students/<Department>/<Year>/<Division>/<StudentName>/
            $baseDir = __DIR__;
            $dept = $department ?: $class;
            $targetRel = 'Students/'.$dept.'/'.$year.'/'.$division.'/'.$safeName;
            $targetAbs = $baseDir.DIRECTORY_SEPARATOR.'Students'.DIRECTORY_SEPARATOR.$dept.DIRECTORY_SEPARATOR.$year.DIRECTORY_SEPARATOR.$division.DIRECTORY_SEPARATOR.$safeName;
            
            // Create hierarchical directory structure
            if(!is_dir($targetAbs)) @mkdir($targetAbs, 0777, true);
            $saved = 0;
            
            // Handle photos - check if it's array or not
            $photoNames = $_FILES['photos']['name'] ?? [];
            $photoTmps = $_FILES['photos']['tmp_name'] ?? [];
            $photoErrors = $_FILES['photos']['error'] ?? [];
            
            // If single file, convert to array format
            if(!is_array($photoNames)){
                $photoNames = [$photoNames];
                $photoTmps = [$photoTmps];
                $photoErrors = [$photoErrors];
            }
            
            foreach($photoNames as $i => $fn){
                if(!isset($photoTmps[$i]) || !isset($photoErrors[$i])) continue;
                if($photoErrors[$i] !== UPLOAD_ERR_OK) continue;
                $tmp = $photoTmps[$i];
                $ext = pathinfo($fn, PATHINFO_EXTENSION);
                if(!in_array(strtolower($ext), ['jpg','jpeg','png','gif','bmp','webp'])) continue;
                // Keep original filename
                $destName = $fn;
                $dest = $targetAbs.DIRECTORY_SEPARATOR.$destName;
                // Handle name collision
                $j = 1;
                $baseName = pathinfo($destName, PATHINFO_FILENAME);
                while(file_exists($dest)){
                    $destName = $baseName.'_'.$j.'.'.$ext;
                    $dest = $targetAbs.DIRECTORY_SEPARATOR.$destName;
                    $j++;
                }
                if(@move_uploaded_file($tmp, $dest)) $saved++;
            }
            // Use forward slashes for web paths
            $pdo->prepare("UPDATE students SET photo_folder_path=? WHERE id=?")->execute([$targetRel, $sid]);
            
            // Log activity
            $activityDesc = "Added student: {$name} (Roll No: {$roll})";
            $stmt = $pdo->prepare("INSERT INTO teacher_activities (activity_type, activity_description, student_name, department, year, division) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute(['student_added', $activityDesc, $name, $department ?: $class, $year, $division]);
            
            // Save to students.csv (format for face recognition: RollNo, Name)
            $csvPath = $baseDir.DIRECTORY_SEPARATOR.'students.csv';
            // Create CSV with header if it doesn't exist
            if(!file_exists($csvPath)){
                $fh = @fopen($csvPath, 'w');
                if($fh !== false){
                    fputcsv($fh, ['RollNo', 'Name']);
                    fclose($fh);
                }
            }
            // Append student data to CSV
            $fh = @fopen($csvPath, 'a');
            if($fh !== false){
                fputcsv($fh, [$roll, $name]);
                fclose($fh);
            }
            
            echo json_encode(['success'=>true,'id'=>$sid,'photos_saved'=>$saved]);
        } else {
            // JSON path (backward compatible)
            $data = json_decode(file_get_contents('php://input'), true);
            $stmt = $pdo->prepare("INSERT INTO students (name, email, phone, roll_no, class_name, section, department, image_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $result = $stmt->execute([
                $data['name'],
                $data['email'] ?? '',
                $data['phone'] ?? '',
                $data['roll_no'] ?? '',
                $data['class_name'] ?? '',
                $data['section'] ?? '',
                $data['department'] ?? '',
                $data['image_data'] ?? ''
            ]);
            if($result) {
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Failed to add student']);
            }
        }
        break;
        
    case 'PUT':
        // Update student
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'];
        
        $stmt = $pdo->prepare("UPDATE students SET name=?, email=?, phone=?, roll_no=?, class=?, year=?, division=?, class_name=?, section=?, department=?, image_data=? WHERE id=?");
        $result = $stmt->execute([
            $data['name'],
            $data['email'],
            $data['phone'] ?? '',
            $data['roll_no'] ?? '',
            $data['class'] ?? ($data['class_name'] ?? ''),
            $data['year'] ?? '',
            $data['division'] ?? '',
            $data['class_name'] ?? '',
            $data['section'] ?? '',
            $data['department'] ?? '',
            $data['image_data'] ?? '',
            $id
        ]);
        
        echo json_encode(['success' => $result]);
        break;
        
    case 'DELETE':
        // Delete student
        $id = $_GET['id'];
        
        // Get student info before deleting (for CSV removal and activity log)
        $stmt = $pdo->prepare("SELECT name, roll_no, department, year, division, photo_folder_path FROM students WHERE id = ?");
        $stmt->execute([$id]);
        $student = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Delete from database
        $stmt = $pdo->prepare("DELETE FROM students WHERE id = ?");
        $result = $stmt->execute([$id]);
        
        if($result && $student){
            // Log activity
            $activityDesc = "Deleted student: {$student['name']} (Roll No: {$student['roll_no']})";
            $stmt = $pdo->prepare("INSERT INTO teacher_activities (activity_type, activity_description, student_name, department, year, division) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute(['student_deleted', $activityDesc, $student['name'], $student['department'], $student['year'], $student['division']]);
            
            // Delete from CSV
            // Delete from CSV
            $baseDir = __DIR__;
            $csvPath = $baseDir.DIRECTORY_SEPARATOR.'students.csv';
            if(file_exists($csvPath)){
                $lines = file($csvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $fh = @fopen($csvPath, 'w');
                if($fh !== false){
                    foreach($lines as $line){
                        $data = str_getcsv($line);
                        // Keep header and lines that don't match this roll number
                        if(!isset($data[0]) || $data[0] === 'RollNo' || $data[0] !== $student['roll_no']){
                            fwrite($fh, $line.PHP_EOL);
                        }
                    }
                    fclose($fh);
                }
            }
            
            // Delete folder and images
            if($student['photo_folder_path']){
                $folderPath = $baseDir.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $student['photo_folder_path']);
                if(is_dir($folderPath)){
                    // Delete all files in folder (including hidden files)
                    $files = array_merge(
                        glob($folderPath.DIRECTORY_SEPARATOR.'*'),
                        glob($folderPath.DIRECTORY_SEPARATOR.'.*')
                    );
                    foreach($files as $file){
                        $basename = basename($file);
                        if($basename === '.' || $basename === '..') continue;
                        if(is_file($file)){
                            @unlink($file);
                        } elseif(is_dir($file)){
                            // Handle subdirectories like 'images' folder
                            $subFiles = glob($file.DIRECTORY_SEPARATOR.'*');
                            foreach($subFiles as $subFile){
                                if(is_file($subFile)) @unlink($subFile);
                            }
                            @rmdir($file);
                        }
                    }
                    // Remove main folder
                    @rmdir($folderPath);
                }
            }
        }
        
        echo json_encode(['success' => $result]);
        break;
}
?>
