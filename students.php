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
    // add columns if they don't exist
    $cols = ['photo_folder_path VARCHAR(255) DEFAULT \''\''', 'face_encoding MEDIUMTEXT', 'class VARCHAR(50) DEFAULT \''\'', 'year VARCHAR(10) DEFAULT \''\'', 'division VARCHAR(10) DEFAULT \''\''];
    foreach ($cols as $def) {
        try { $pdo->exec("ALTER TABLE students ADD COLUMN $def"); } catch(Exception $e) { /* ignore */ }
    }
    // Add unique constraint on roll_no if it doesn't exist
    try { $pdo->exec("ALTER TABLE students ADD UNIQUE KEY unique_roll_no (roll_no)"); } catch(Exception $e) { /* ignore if already exists */ }
} catch (Exception $e) { /* ignore */ }

switch($method) {
    case 'GET':
        // Get all students
        $stmt = $pdo->query("SELECT id, name, email, phone, roll_no, class, year, division, class_name, section, department, photo_folder_path, created_at FROM students ORDER BY created_at DESC");
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($students);
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
            $baseDir = dirname(__DIR__);
            $targetRel = 'uploads/students/'.$sid;
            $targetAbs = $baseDir.DIRECTORY_SEPARATOR.$targetRel;
            if(!is_dir($targetAbs)) @mkdir($targetAbs, 0777, true);
            $saved = 0;
            foreach(($_FILES['photos']['name'] ?? []) as $i => $fn){
                if(!isset($_FILES['photos']['tmp_name'][$i])) continue;
                $tmp = $_FILES['photos']['tmp_name'][$i];
                $ext = pathinfo($fn, PATHINFO_EXTENSION);
                if(!in_array(strtolower($ext), ['jpg','jpeg','png'])) continue;
                $dest = $targetAbs.DIRECTORY_SEPARATOR.('img'.($i+1)).'.'.$ext;
                if(@move_uploaded_file($tmp, $dest)) $saved++;
            }
            $pdo->prepare("UPDATE students SET photo_folder_path=? WHERE id=?")->execute([$targetRel, $sid]);
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
        $stmt = $pdo->prepare("DELETE FROM students WHERE id = ?");
        $result = $stmt->execute([$id]);
        echo json_encode(['success' => $result]);
        break;
}
?>
