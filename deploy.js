const fs = require('fs');
const path = require('path');

// 배포할 파일들을 복사하는 함수
function copyFiles() {
  console.log('🚀 GitHub Pages 배포 준비 중...');
  
  // dist 폴더의 파일들을 루트로 복사
  const distPath = path.join(__dirname, 'dist');
  const files = fs.readdirSync(distPath);
  
  files.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.txt')) {
      const sourcePath = path.join(distPath, file);
      const destPath = path.join(__dirname, file);
      
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ ${file} 복사 완료`);
    }
  });
  
  console.log('🎉 배포 준비 완료!');
  console.log('');
  console.log('📋 다음 단계:');
  console.log('1. git add .');
  console.log('2. git commit -m "Deploy to GitHub Pages"');
  console.log('3. git push origin main');
  console.log('');
  console.log('🌐 또는 npm run deploy 명령어를 사용하세요.');
}

// 스크립트 실행
copyFiles(); 