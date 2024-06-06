const uploadRequests = {}; // Store upload requests for each file

function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(function (section) {
        section.style.display = 'none';
    });

    var section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    } else {
        console.error(`Element with ID ${sectionId} not found`);
    }

    document.querySelectorAll('.menu-bar button').forEach(function (button) {
        button.classList.remove('active');
    });

    var button = document.getElementById(sectionId + 'Btn');
    if (button) {
        button.classList.add('active');
    } else {
        console.error(`Button with ID ${sectionId}Btn not found`);
    }
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

function uploadFiles(files) {
    const fileList = document.getElementById('file-list');

    for (const file of files) {
        const truncatedFilename = truncateFilename(file.name, 70);
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-item-name">
                ${truncatedFilename}
                <button class="remove-button" onclick="removeFile('${file.name}', this)">&#10006;</button>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-files" id="progress-bar-${file.name}"></div>
            </div>
        `;
        fileList.appendChild(fileItem);

        uploadFile(file);
    }
}

function uploadFile(file) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    xhr.upload.addEventListener('progress', function (event) {
        if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            const progressBar = document.getElementById(`progress-bar-${file.name}`);
            progressBar.style.width = progress + '%';
        }
    });

    xhr.onload = function () {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.files && response.files.includes(file.name)) {
                const progressBar = document.getElementById(`progress-bar-${file.name}`);
                progressBar.style.width = '100%';
                setTimeout(() => {
                    progressBar.parentElement.style.display = 'none';
                }, 0); // Hide the progress bar after 1 second
            } else {
                const progressBar = document.getElementById(`progress-bar-${file.name}`);
                progressBar.style.backgroundColor = 'red';
            }
        } else {
            console.error('Upload failed:', xhr.statusText);
        }
    };

    xhr.onerror = function () {
        console.error('Upload error:', xhr.statusText);
    };

    const formData = new FormData();
    formData.append('files', file);
    xhr.send(formData);

    uploadRequests[file.name] = xhr; // Store the XMLHttpRequest object
}

async function removeFile(filename, buttonElement) {
    if (uploadRequests[filename]) {
        uploadRequests[filename].abort(); // Abort the ongoing upload
        delete uploadRequests[filename]; // Remove the request from the storage
    }

    // Immediately remove the file item from the list
    const fileItem = buttonElement.closest('.file-item');
    fileItem.remove();

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

        if (!data.success) {
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
    progressBar.offsetHeight;
    progressBar.classList.remove('no-transition');
}

async function performAnalysis() {
    const BB_size = document.getElementById('BB_size').value;
    const lowdensity = document.getElementById('lowdensity').value;
    const tolerance = document.getElementById('tolerance').value;

    const progressBar = document.getElementById('progress-bar');
    resetProgressBar(progressBar);

    if (!BB_size || !tolerance) {
        alert('Preferences must be set');
        return;
    }

    try {
        const checkResponse = await fetch('/check_files', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!checkResponse.ok) {
            throw new Error(await checkResponse.json().then(data => data.error));
        }

        progressBar.style.width = '1%';
        progressBar.style.width = '30%';
        await sleep(2000);

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

        progressBar.style.width = '100%';
        await sleep(1000);

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();
        console.log(data);

        const resultsDiv = document.getElementById('results');
        const results = data.results;
        const coll_values = data.collimator_dict;
        const gantry_values = data.gantry_dict;
        const table_values = data.table_dict;
        const caxtobb_values = data.caxtobb_dict;
        const names_values = data.names_dict;
        const key_mapping = data.key_mapping;
        const selectedImageDiv = document.getElementById('selected-image');
        const imageTitle = document.getElementById('image-title');

        if (!imageTitle) {
            throw new Error('Image title element not found');
        }

        // Clear previous results and images but keep the image title element
        resultsDiv.innerHTML = '';
        selectedImageDiv.innerHTML = '';
        selectedImageDiv.appendChild(imageTitle);
        imageTitle.textContent = '';

        const sortedKeys = Object.keys(caxtobb_values).sort((a, b) => {
            const numA = parseInt(a.replace('image', ''));
            const numB = parseInt(b.replace('image', ''));
            return numA - numB;
        });

        let tableHtml = `
        <table>
            <colgroup>
                <col class="image">
                <col class="img-name">
                <col class="gantry">
                <col class="coll">
                <col class="table">
                <col class="CAXtoBB">
                <col class="status">
            </colgroup>
            <thead>
                <tr>
                    <th class="image">Image</th>
                    <th class="img-name">File Name</th>
                    <th class="gantry">Gantry</th>
                    <th class="coll">Coll</th>
                    <th class="table">Table</th>
                    <th class="CAXtoBB">&#x2206 (mm)</th>
                    <th class="status">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

        for (const key of sortedKeys) {
            const originalKey = key_mapping[key];
            const caxToBbValue = caxtobb_values[key];
            const status = caxToBbValue <= tolerance ?
                `<span style="color:green;">&#9679;</span> Pass` :
                `<span style="color:red;">&#9679;</span> Fail`;

            tableHtml += `
            <tr>
                <td><a href="#" class="image-link" data-image="${key}">${key}</a></td>
                <td>${names_values[key]}</td>
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

        document.querySelectorAll('.image-link').forEach(link => {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                const imageName = event.target.getAttribute('data-image');
                const imageUrl = `/static/images/analyzedpngs/${imageName}.png`;

                imageTitle.textContent = imageName;

                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = imageName;

                img.onload = function () {
                    img.classList.add('fade-in');
                };

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

    const lockButton = document.getElementById('lock-button');
    lockButton.classList.add('locked'); // Initially set to locked
    const performAnalysisButton = document.getElementById('perform-analysis-button');
    performAnalysisButton.disabled = false; // Enable the Perform Analysis button
    performAnalysisButton.style.backgroundColor = ""; // Reset button color

    const bbSizeInput = document.getElementById('BB_size');
    const lowDensitySelect = document.getElementById('lowdensity');
    const toleranceInput = document.getElementById('tolerance');

    // Set initial state of inputs to disabled
    bbSizeInput.disabled = true;
    lowDensitySelect.disabled = true;
    toleranceInput.disabled = true;
    bbSizeInput.style.backgroundColor = "rgb(100, 100, 100)";
    lowDensitySelect.style.backgroundColor = "rgb(100, 100, 100)";
    toleranceInput.style.backgroundColor = "rgb(100, 100, 100)";

    document.querySelectorAll('.image-item img').forEach(function (img) {
        img.addEventListener('load', function () {
            img.parentElement.classList.add('loaded');
        });
    });

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
        lockButton.classList.remove('locked');
        lockButton.classList.add('unlocked');
        lockIcon.innerHTML = '&#x1F513;';
        bbSizeInput.disabled = false;
        lowDensitySelect.disabled = false;
        toleranceInput.disabled = false;
        bbSizeInput.style.backgroundColor = "rgb(50, 50, 50)";
        lowDensitySelect.style.backgroundColor = "rgb(50, 50, 50)";
        toleranceInput.style.backgroundColor = "rgb(50, 50, 50)";
        performAnalysisButton.disabled = true;
        performAnalysisButton.style.backgroundColor = "grey";
    } else {
        lockButton.classList.remove('unlocked');
        lockButton.classList.add('locked');
        lockIcon.innerHTML = '&#x1F512;';
        bbSizeInput.disabled = true;
        lowDensitySelect.disabled = true;
        toleranceInput.disabled = true;
        bbSizeInput.style.backgroundColor = "rgb(100, 100, 100)";
        lowDensitySelect.style.backgroundColor = "rgb(100, 100, 100)";
        toleranceInput.style.backgroundColor = "rgb(100, 100, 100)";
        performAnalysisButton.disabled = false;
        performAnalysisButton.style.backgroundColor = "";
    }
}