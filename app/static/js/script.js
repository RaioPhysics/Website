function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(function (section) {
        section.style.display = 'none';
    });
    // Show the selected section
    document.getElementById(sectionId).style.display = 'block';

    // Remove 'active' class from all buttons
    document.querySelectorAll('.menu-bar button').forEach(function (button) {
        button.classList.remove('active');
    });
    // Add 'active' class to the clicked button
    document.getElementById(sectionId + 'Btn').classList.add('active');
}

function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function fileInputHandler(event) {
    const files = event.target.files;
    uploadFiles(files);
}

function dropHandler(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    uploadFiles(files);
}

function dragOverHandler(event) {
    event.preventDefault();
}

function truncateFilename(filename, maxLength) {
    if (filename.length > maxLength) {
        return filename.slice(0, maxLength) + '...';
    }
    return filename;
}

async function uploadFiles(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        console.log(data);

        // Dynamically update the file list
        const fileList = document.getElementById('file-list');
        //fileList.innerHTML = ''; // Clear the existing files

        data.files.forEach(filename => {
            const truncatedFilename = truncateFilename(filename, 70); // Truncate the filename
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `${truncatedFilename} <button onclick="removeFile('${filename}', this)">&#10006;</button>`;
            fileList.appendChild(fileItem);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

async function removeFile(filename, buttonElement) {
    try {
        const response = await fetch('/remove_file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename: filename })
        });
        const data = await response.json();
        console.log(data);

        if (data.success) {
            // Remove the file item from the list
            const fileItem = buttonElement.parentElement;
            fileItem.remove();
        } else {
            console.error('Error removing file:', data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function resetProgressBar(progressBar) {
    progressBar.classList.add('no-transition');
    progressBar.style.width = '0%';
    // Force a reflow to apply the width change immediately
    progressBar.offsetHeight; // This line forces a reflow
    progressBar.classList.remove('no-transition');
}


async function performAnalysis() {
    const BB_size = document.getElementById('BB_size').value;
    const lowdensity = document.getElementById('lowdensity').value;
    const tolerance = document.getElementById('tolerance').value;

    const progressBar = document.getElementById('progress-bar');
    resetProgressBar(progressBar);

    // Check if BB_size or tolerance inputs are empty
    if (!BB_size || !tolerance) {
        alert('Preferences must be set');
        return; // Exit the function early
    }

    try {
        // Check if there are files in the directory
        const checkResponse = await fetch('/check_files', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!checkResponse.ok) {
            throw new Error(await checkResponse.json().then(data => data.error));
        }

        // Simulate progress (this is for demonstration purposes)
        progressBar.style.width = '1%';
        progressBar.style.width = '30%';
        await sleep(3000); // Pause for 2 seconds

        progressBar.style.width = '60%';

        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                BB_size: parseInt(BB_size, 10),
                lowdensity: lowdensity === 'true',
                tolerance: parseInt(tolerance, 10)
            })
        });

        // Complete the progress bar animation
        progressBar.style.width = '100%';

        await sleep(1000); // Pause for a short time

        if (!response.ok) {
            throw new Error(await response.text());
        }

        // Handle the response
        const data = await response.json();
        console.log(data); // Log the response data to inspect it

        const resultsDiv = document.getElementById('results');
        const results = data.results;
        const coll_values = data.collimator_dict;
        const gantry_values = data.gantry_dict;
        const table_values = data.table_dict;
        const caxtobb_values = data.caxtobb_dict;
        const key_mapping = data.key_mapping;
        const selectedImageDiv = document.getElementById('selected-image');
        const imageTitle = document.getElementById('image-title');

        selectedImageDiv.innerHTML = '';
        imageTitle.textContent = '';

        // Get the keys and sort them numerically
        const sortedKeys = Object.keys(caxtobb_values).sort((a, b) => {
            const numA = parseInt(a.replace('image', ''));
            const numB = parseInt(b.replace('image', ''));
            return numA - numB;
        });

        // Build the results table
        let tableHtml = `
        <table>
            <colgroup>
                <col class="image">
                <col class="gantry">
                <col class="coll">
                <col class="table">
                <col class="CAXtoBB">
                <col class="status">
            </colgroup>
            <thead>
                <tr>
                    <th class="image">Image</th>
                    <th class="gantry">Gantry</th>
                    <th class="coll">Coll</th>
                    <th class="table">Table</th>
                    <th class="CAXtoBB">CAX to BB (mm)</th>
                    <th class="status">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

        // Dynamically add rows based on the sorted image keys
        for (const key of sortedKeys) {
            const originalKey = key_mapping[key];
            const caxToBbValue = caxtobb_values[key];
            const status = caxToBbValue <= tolerance ?
                `<span style="color:green;">&#9679;</span> Pass` :
                `<span style="color:red;">&#9679;</span> Fail`;

            tableHtml += `
            <tr>
                <td><a href="#" class="image-link" data-image="${key}">${key}</a></td>
                <td>${gantry_values[originalKey]}</td>
                <td>${coll_values[originalKey]}</td>
                <td>${table_values[originalKey]}</td>
                <td>${caxToBbValue}</td>
                <td>${status}</td>
            </tr>
        `;
        }

        tableHtml += `
            </tbody>
        </table>
    `;
        resultsDiv.innerHTML = tableHtml;

        // Add click event listeners to the image links
        document.querySelectorAll('.image-link').forEach(link => {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                const imageName = event.target.getAttribute('data-image');
                const imageUrl = `/static/images/analyzedpngs/${imageName}.png`;

                // Set the title text
                imageTitle.textContent = imageName;

                // Create a new image element
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = imageName;

                // Add the fade-in class after the image is loaded
                img.onload = function () {
                    img.classList.add('fade-in');
                };

                // Clear the previous content and add the new image
                selectedImageDiv.innerHTML = '';
                selectedImageDiv.appendChild(imageTitle);
                selectedImageDiv.appendChild(img);
            });
        });
    } catch (error) {
        console.error('Error:', error);
        resetProgressBar(progressBar);
        alert(error.message);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    showSection('winston');

    // Set initial state
    const lockButton = document.getElementById('lock-button');
    lockButton.classList.add('unlocked');
    const performAnalysisButton = document.getElementById('perform-analysis-button');
    performAnalysisButton.disabled = true;
    performAnalysisButton.style.backgroundColor = "grey";

    // Add the 'loaded' class to images once they have loaded
    document.querySelectorAll('.image-item img').forEach(function (img) {
        img.addEventListener('load', function () {
            img.parentElement.classList.add('loaded');
        });
    });

    // Clear the 'files_saved_here' directory when the modules page is loaded
    fetch('/clear_files', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Files cleared successfully');
            } else {
                console.error('Error clearing files:', data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
});



function toggleLock() {
    const progressBar = document.getElementById('progress-bar');
    const lockButton = document.getElementById('lock-button');
    const lockIcon = document.getElementById('lock-icon');
    const performAnalysisButton = document.getElementById('perform-analysis-button');
    const bbSizeInput = document.getElementById('BB_size');
    const lowDensitySelect = document.getElementById('lowdensity');
    const toleranceInput = document.getElementById('tolerance');

    if (lockButton.classList.contains('locked')) {
        // Unlock the inputs
        progressBar.style.visibility = 'hidden'; // Show the progress bar
        lockButton.classList.remove('locked');
        lockButton.classList.add('unlocked');
        lockIcon.innerHTML = '&#x1F513;'; // Unicode for unlocked icon
        bbSizeInput.disabled = false;
        lowDensitySelect.disabled = false;
        toleranceInput.disabled = false;
        bbSizeInput.style.backgroundColor = "rgb(50, 50, 50)";
        lowDensitySelect.style.backgroundColor = "rgb(50, 50, 50)";
        toleranceInput.style.backgroundColor = "rgb(50, 50, 50)";
        performAnalysisButton.disabled = true; // Disable the Perform Analysis button
        performAnalysisButton.style.backgroundColor = "grey"; // Change button color to grey
    } else {
        // Lock the inputs
        progressBar.style.visibility = 'visible'; // Show the progress bar
        lockButton.classList.remove('unlocked');
        lockButton.classList.add('locked');
        lockIcon.innerHTML = '&#x1F512;'; // Unicode for locked icon
        bbSizeInput.disabled = true;
        lowDensitySelect.disabled = true;
        toleranceInput.disabled = true;
        bbSizeInput.style.backgroundColor = "rgb(100, 100, 100)";
        lowDensitySelect.style.backgroundColor = "rgb(100, 100, 100)";
        toleranceInput.style.backgroundColor = "rgb(100, 100, 100)";
        performAnalysisButton.disabled = false; // Enable the Perform Analysis button
        performAnalysisButton.style.backgroundColor = ""; // Reset button color
    }
}

// Set default section to show on page load
document.addEventListener('DOMContentLoaded', function () {
    showSection('winston');

    // Set initial state
    const lockButton = document.getElementById('lock-button');
    lockButton.classList.add('unlocked');
    const performAnalysisButton = document.getElementById('perform-analysis-button');
    performAnalysisButton.disabled = true;
    performAnalysisButton.style.backgroundColor = "grey";

    // Add the 'loaded' class to images once they have loaded
    document.querySelectorAll('.image-item img').forEach(function (img) {
        img.addEventListener('load', function () {
            img.parentElement.classList.add('loaded');
        });
    });

    // Clear the 'files_saved_here' directory when the modules page is loaded
    fetch('/clear_files', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Files cleared successfully');
            } else {
                console.error('Error clearing files:', data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
});