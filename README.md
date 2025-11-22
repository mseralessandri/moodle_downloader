# moodle_downloader

A tiny helper you can run from your web browser to save files from a Moodle course page.

This tool is intended for end users who want an easy way to download many attachments (slides, PDFs, documents) from a course page by copy‑pasting a small script into the browser Developer Tools console.

## What it does
- When run on a Moodle course page, the script finds links to downloadable files on that page and saves them into a folder you choose on your computer.
- No installation required — you run it in the browser while logged into Moodle.
- It only downloads files your account is allowed to access.
- It creates a folder per Moodle section and names files using the activity title plus the original filename.

Important: this script is intended for desktop Chromium browsers (Chrome / Edge) because it uses the File System Access API (the folder picker).

## Quick how-to (exact steps for this script)
1. Open the Moodle course page (the URL will be like course/view.php?id=...) and sign in with your usual account.
2. Open Developer Tools and go to the Console:
   - Chrome / Edge: F12 or Ctrl+Shift+I (Cmd+Opt+I on macOS), then Console.
3. Get the script text:
   - Open moodel_downloader.js in this repository, click “Raw” (or open in an editor) and copy the entire file.
4. Paste the copied script into the Console and press Enter.
5. A blue button will appear in the top-right of the page. Click it and use the folder picker to select the destination folder where downloads should be saved.
   - The script will create one subfolder per Moodle section inside the folder you chose.
6. Let the script run. It will:
   - Scan the course page for resource activities (files and folders).
   - For folder activities it will crawl subpages of the same folder id to find files inside subfolders.
   - Download each file it finds into the matching section folder using names formatted like:
     "<activity title> - <original filename>"
7. When the script finishes you'll get an alert with a short summary: how many files were downloaded, how many failed, and the total processed. A more detailed log is printed to the Console.

## What the script specifically does and does not do
- It looks for links/resources using Moodle's pluginfile URLs and common attributes used by resource/folder activities.
- It follows folder pages that belong to the same folder id (it crawls subpages of a folder activity to collect all files).
- It skips activity types that aren't resources (for example forum, quiz, assign links are ignored).
- It avoids downloading the same exact file URL more than once per run.
- Filenames are sanitized to remove characters not allowed in file names.
- It uses short delays between pages/files to avoid flooding the server.
- At the end it shows a simple report (alert + Console log) with counts: downloaded OK, failed, total.

Note: This version does not implement automatic retries for failed downloads. Failed URLs are listed in the final report/Console so you can retry them manually or re-run the script on the same page.

## Where files are saved
- Files are saved in the folder you select via the browser folder picker.
- Inside that folder the script creates one subfolder per Moodle section title (sanitized).
- File names include the activity title and the original file name, both sanitized to avoid invalid characters.

## Troubleshooting (practical tips)
- If you don't see the blue folder button:
  - Make sure you pasted the whole script and pressed Enter.
  - The page must be served over HTTPS and you must be on the course page.
- If the folder picker fails or is not supported:
  - The File System Access API is supported in Chromium-based browsers (Chrome, Edge). Firefox does not fully support it.
- If downloads are blocked by the browser:
  - Allow downloads/popups for the Moodle site or confirm any browser prompts.
- If some files don't download:
  - They may be protected by permissions or hosted on a service that prevents direct download. Check the Console log for details and try those manually.
- To retry failed items:
  - Copy the failed URLs from the Console and try them manually, or re-run the script on the same course/section page.

## Safety and permissions
- Only use this for courses you are authorized to access.
- The script runs in your browser and uses the session you are already logged in with; it does not send your credentials elsewhere.
- If your site uses SSO or 2FA, make sure you are already logged in before running the script.

## Re-running and scope
- Run the script on whichever course page or section you want to download. If a course has multiple pages/sections, open each page and run the script again (it will skip files it already saw in the same run).
- The script will skip non-resource activities (like forums, quizzes, assignments).
