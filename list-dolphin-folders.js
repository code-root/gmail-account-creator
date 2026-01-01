/**
 * Script to list all Dolphin Anty folders
 * سكريبت لعرض جميع مجلدات Dolphin Anty
 */

// Load .env file first (config.js will also load it, but we load it here for early validation)
// تحميل ملف .env أولاً (config.js سيقوم بتحميله أيضاً، لكننا نحمله هنا للتحقق المبكر)
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
if (!process.env.DOLPHIN_API_KEY) {
    dotenv.config({ path: path.resolve(__dirname, '.emv') });
}

// Import after loading .env
// الاستيراد بعد تحميل .env
import { getAllFolders } from './src/dolphin/client.js';
import config from './src/config.js';


async function listAllFolders() {
    try {
        console.log('🔍 جارٍ جلب قائمة المجلدات...\n');
        console.log(`📡 API URL: ${config.dolphin.apiUrl}`);
        
        if (!config.dolphin.apiKey || config.dolphin.apiKey.trim() === '') {
            console.error('❌ خطأ: DOLPHIN_API_KEY غير محدد');
            console.error('\n💡 الحل: أضف DOLPHIN_API_KEY إلى ملف .env');
            console.error('   مثال: DOLPHIN_API_KEY=your_api_key_here\n');
            process.exit(1);
        }
        
        console.log(`🔑 API Key: ${config.dolphin.apiKey.substring(0, 20)}...\n`);

        // Use the optimized function from client.js
        // استخدام الدالة المحسّنة من client.js
        console.log('🔐 جارٍ الاتصال بـ Dolphin API...\n');
        const allFolders = await getAllFolders();

        console.log(`\n✅ تم العثور على ${allFolders.length} مجلد:\n`);
        console.log('=' .repeat(80));

        if (allFolders.length === 0) {
            console.log('⚠️  لا توجد مجلدات. يمكنك إنشاء مجلد جديد من Dolphin Anty.');
            return;
        }

        allFolders.forEach((folder, index) => {
            const folderId = folder.id || folder.folderId;
            const folderName = folder.folderName || folder.name || 'بدون اسم';
            const folderColor = folder.folderColor || folder.color || '#3370FF';
            const resourceCount = folder.resourceCount || folder.browserProfilesData?.length || 0;
            
            console.log(`\n📁 المجلد ${index + 1}:`);
            console.log(`   الاسم: ${folderName}`);
            console.log(`   ID: ${folderId}`);
            console.log(`   اللون: ${folderColor}`);
            console.log(`   عدد البروفايلات: ${resourceCount}`);
        });

        console.log('\n' + '='.repeat(80));
        console.log('\n📝 لاستخدام مجلد محدد، أضف السطر التالي إلى ملف .env:');
        console.log(`DOLPHIN_FOLDER_ID=<folder_id_here>\n`);

        // Show first folder as example
        if (allFolders.length > 0) {
            const firstFolder = allFolders[0];
            const firstFolderId = firstFolder.id || firstFolder.folderId;
            console.log(`مثال (استخدام أول مجلد):`);
            console.log(`DOLPHIN_FOLDER_ID=${firstFolderId}\n`);
        }

    } catch (error) {
        console.error('\n❌ خطأ في جلب المجلدات:');
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.data?.message || error.message}`);
            
            if (error.response.status === 401) {
                console.error('\n💡 الحل:');
                console.error('   1. تأكد من صحة API key في ملف .env');
                console.error('   2. تأكد من أن Dolphin Anty يعمل');
                console.error('   3. تحقق من أن API key لديه صلاحيات قراءة المجلدات');
                console.error('   4. جرب إنشاء API key جديد من Dolphin Anty');
            } else if (error.response.status === 403 || error.response.status === 400) {
                console.error('\n💡 الحل: تأكد من أن API key لديه صلاحيات قراءة المجلدات');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.error(`   لا يمكن الاتصال بـ Dolphin Anty API على ${config.dolphin.apiUrl}`);
            console.error('\n💡 الحل: تأكد من أن Dolphin Anty يعمل وأن API مفعّل');
        } else {
            console.error(`   ${error.message}`);
        }
        
        process.exit(1);
    }
}

// Run the script
listAllFolders().catch(error => {
    console.error('خطأ غير متوقع:', error);
    process.exit(1);
});

