const url = "../docs/npdf.pdf";
let newAnnotations = {};
let uploadedPdfBuffer = null;
let scannedPages = [];
let dialogOpen = false;
let boundingBoxes = [];
let pdfDoc = null,
  pageNum = 1,
  pageIsRendering = false,
  pageNumIsPending = null;
let annotations = {}; // Store annotations by page number

const scale = 1.5,
  canvas = document.querySelector("#pdf-render"),
  ctx = canvas.getContext("2d");

// Render the page
const renderPage = (num) => {
  pageIsRendering = true;

  // Hide previous annotations
  Object.values(annotations).forEach((pageAnnotations) => {
    pageAnnotations.forEach((annotation) => {
      if (annotation.element) {
        annotation.element.style.display = "none";
      }
    });
  });

  // Show annotations for the current page
  if (annotations[num]) {
    annotations[num].forEach((annotation) => {
      if (annotation.element) {
        annotation.element.style.display = "block";
      }
    });
  }

  // Get page
  pdfDoc.getPage(num).then((page) => {
    // Set scale
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderCtx = {
      canvasContext: ctx,
      viewport,
    };

    page.render(renderCtx).promise.then(() => {
      pageIsRendering = false;

      if (pageNumIsPending !== null) {
        renderPage(pageNumIsPending);
        pageNumIsPending = null;
      }
    });

    // Output current page
    document.querySelector("#page-num").textContent = num;
  });
};

// Check for pages rendering
const queueRenderPage = (num) => {
  if (pageIsRendering) {
    pageNumIsPending = num;
  } else {
    renderPage(num);
  }
};

// Show Prev Page
const showPrevPage = () => {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  handleTessButtonClick();
  queueRenderPage(pageNum);
  loadProgress();
};

// Show Next Page
const showNextPage = () => {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  handleTessButtonClick();
  queueRenderPage(pageNum);
  loadProgress();
  const button = document.getElementById("next-page"); //make sure it is the right button!!!

  if (scannedPages.includes(pageNum)) {
    button.style.setProperty("--primary-color", "red");
    // or any color to indicate it's scanned
  } else {
    button.style.setProperty(
      "--primary-color",
      "linear-gradient(90deg, #1e3c72 0%, #2a5298 100%"
    ); // reset to default color
  }
};

// Get Document
pdfjsLib
  .getDocument(url)
  .promise.then((pdfDoc_) => {
    pdfDoc = pdfDoc_;

    document.querySelector("#page-count").textContent = pdfDoc.numPages;

    renderPage(pageNum);
  })
  .catch((err) => {
    // Display error
    const div = document.createElement("div");
    div.className = "error";
    div.appendChild(document.createTextNode(err.message));
    document.querySelector("body").insertBefore(div, canvas);
    // Remove top bar
    document.querySelector(".top-bar").style.display = "none";
  });

// Add annotations functionality

function addAnnotation(event) {
  if (dialogOpen) return;

  const rect = canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
    alert("Please add annotations within the bounds of the page.");
    return;
  }

  const dialog = document.createElement("div");
  dialog.className = "annotation-dialog";

  const headingLabel = document.createElement("label");
  headingLabel.textContent = "Headings: ";
  const headingTextarea = document.createElement("textarea");
  headingLabel.appendChild(headingTextarea);
  dialog.appendChild(headingLabel);

  const commentLabel = document.createElement("label");
  commentLabel.textContent = "Comments: ";
  const commentTextarea = document.createElement("textarea");
  commentLabel.appendChild(commentTextarea);
  dialog.appendChild(commentLabel);

  let isDragging = false;
  let offsetX, offsetY;
  dialog.addEventListener(
    "touchmove",
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );
  const startDrag = (event) => {
    isDragging = true;
    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;
    offsetX = clientX - dialog.getBoundingClientRect().left - window.scrollX;
    offsetY = clientY - dialog.getBoundingClientRect().top - window.scrollY;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onMouseMove);
    document.addEventListener("touchend", onMouseUp);
  };

  dialog.addEventListener("mousedown", startDrag);
  dialog.addEventListener("touchstart", startDrag);

  function onMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    dialog.style.left = clientX - offsetX + "px";
    dialog.style.top = clientY - offsetY + "px";
    dialog.style.transform = "none";
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchmove", onMouseMove);
    document.removeEventListener("touchend", onMouseUp);
  }

  const submitButton = document.createElement("button");
  submitButton.textContent = "Submit";
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";

  dialog.appendChild(submitButton);
  dialog.appendChild(cancelButton);
  document.body.appendChild(dialog);
  requestAnimationFrame(() => {
    dialog.classList.add("visible");
  });
  dialogOpen = true;

  submitButton.addEventListener("click", function () {
    const region = getRegion(x, y);
    const headingText = headingTextarea.value;
    const commentText = commentTextarea.value;

    if (headingText && commentText) {
      const star = createStarElement(x, y);
      const annotation = createAnnotationElement(headingText, commentText);

      attachAnnotationToStar(star, annotation);

      document.getElementById("pdf-container").appendChild(star);
      storeAnnotationForPage(
        pageNum,
        headingText,
        commentText,
        star,
        x,
        y,
        region
      );
      addAnnotationToMemory(pageNum, annotation);
      checkAnnotationsInBoundingBox();
    }

    // Save the progress
    saveProgress();
    // Remove dialog box
    // Wait for the transition to complete before actually removing the dialog
    removeDialog(dialog);
    document.getElementById("generate-comments").disabled = false;
  });

  cancelButton.addEventListener("click", function () {
    removeDialog(dialog);
  });
}

function addAnnotationToMemory(pageNum, annotation) {
  if (!newAnnotations[pageNum]) {
    newAnnotations[pageNum] = [];
  }
  newAnnotations[pageNum].push(annotation);
}

//additional functions
function createStarElement(x, y, annotationText) {
  const star = document.createElement("div");
  star.className = "star";
  star.innerHTML = "&#9733;"; // Unicode star character

  const annotation = document.createElement("div");

  annotation.className = "annotation";
  annotation.textContent = annotationText;
  annotation.style.display = "none";

  // Centering adjustment
  x -= 10;
  y -= 10;

  star.style.left = x + "px";
  star.style.top = y + "px";

  // Show annotation on hover
  star.addEventListener("mouseover", function () {
    annotation.style.display = "block";
  });
  star.addEventListener("mouseout", function () {
    annotation.style.display = "none";
  });
  star.addEventListener("click", function (event) {
    event.stopPropagation();
  });
  star.appendChild(annotation);
  return star;
}

function createAnnotationElement(headingText, commentText) {
  const annotationText = `Heading: ${headingText}\nComment: ${commentText}`;
  const annotation = document.createElement("div");
  annotation.className = "annotation";
  annotation.textContent = annotationText;
  annotation.style.display = "none";

  return annotation;
}

function attachAnnotationToStar(star, annotation) {
  star.appendChild(annotation);

  // Show annotation on hover
  star.addEventListener("mouseover", function () {
    annotation.style.display = "block";
  });
  star.addEventListener("mouseout", function () {
    annotation.style.display = "none";
  });
}

function storeAnnotationForPage(
  pageNum,
  headingText,
  commentText,
  star,
  x,
  y,
  region
) {
  if (!annotations[pageNum]) {
    annotations[pageNum] = [];
  }
  annotations[pageNum].push({
    heading: headingText,
    comment: commentText,
    element: star,
    x: x,
    y: y,
    region: region,
    pageNum: pageNum,
  });
}

function removeDialog(dialog) {
  dialog.classList.remove("visible");
  dialog.addEventListener(
    "transitionend",
    () => {
      dialog.remove();
      dialogOpen = false;
    },
    { once: true }
  );
}

function clearAnnotations() {
  const stars = document.querySelectorAll(".star");
  stars.forEach((star) => star.remove());
  annotations = {}; // Assuming annotations is a global object storing your annotations
  scannedPages = [];
}

function hideAllAnnotations() {
  Object.values(annotations).forEach((pageAnnotations) => {
    pageAnnotations.forEach((annotation) => {
      if (annotation.element) {
        annotation.element.style.display = "none";
      }
    });
  });
}

function checkAnnotationsInBoundingBox() {
  const offsetX = 1.5; // Horizontal offset
  const offsetY = 7.5; // Vertical offset

  Object.values(annotations).forEach((pageAnnotations) => {
    pageAnnotations.forEach((annotation, index) => {
      // Include the index
      const x = annotation.x;
      const y = annotation.y;
      let insideBoundingBox = false;
      let box;
      for (let i = 0; i < boundingBoxes.length; i++) {
        box = boundingBoxes[i];
        if (
          x >= box.x0 + offsetX &&
          x <= box.x1 - offsetX &&
          y >= box.y0 - offsetY &&
          y <= box.y1 - offsetY
        ) {
          const textContent = box.text; // You'll need to define this function
          const words = textContent.split(/\s+/);
          const firstWord = words.slice(0, 3).join(" ");
          const lastWord = words.slice(-3).join(" ");

          // Store the first and last words with the annotation
          annotation.firstWord = firstWord;
          annotation.lastWord = lastWord;
          insideBoundingBox = true;
          console.log(
            `Annotation at on line ${box.number}. and text is ${box.text}}`
          );
          annotation.boundingBoxNumber = box.number; // Store the bounding box number
          pageAnnotations[index] = annotation; // Update the annotation in the pageAnnotations array
        }
      }
      if (!insideBoundingBox) {
        console.log(
          `Annotation at (${x}, ${y}) is not inside any bounding box.`
        );
      }
    });
  });
}

function generateComments() {
  if (Object.keys(annotations).length === 0) {
    alert("No annotations added!");
    return;
  }
  pdfDoc.getMetadata().then((metadata) => {
    let title = metadata.info.Title;

    // Replace any characters that are not suitable for a filename
    title = title.replace(/[^a-zA-Z0-9 \-_]+/g, "");

    // Concatenate the date to the title
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}`;
    const filename = `${title}_${formattedDate}.txt`;

    let sortedAnnotations = [];

    // Flatten the annotations and push them to the sortedAnnotations array
    for (let page in annotations) {
      annotations[page].forEach((annotation) => {
        annotation.page = page; // Add the page number to each annotation
        sortedAnnotations.push(annotation);
      });
    }

    // Sort the annotations by page and then by line number
    sortedAnnotations.sort((a, b) => {
      if (a.page === b.page) {
        return a.boundingBoxNumber - b.boundingBoxNumber;
      }
      return a.page - b.page;
    });

    // Generate the comments from the sorted annotations
    let userTemplate = document.getElementById("templateInput").value;

    let commentsText = "";
    let currentPage = null;

    sortedAnnotations.forEach((annotation) => {
      if (currentPage !== annotation.page) {
        commentsText += `Page ${annotation.page}:\n`;
        currentPage = annotation.page;
      }

      // Embed variables into user template
      let customComment = userTemplate
        .replace("{Topic}", annotation.heading)
        .replace("{comment}", annotation.comment)
        .replace("{LineNumber}", annotation.boundingBoxNumber);

      // Append the custom comment and other fixed information
      commentsText += `${customComment} (ref. ${annotation.region} ${annotation.firstWord}...${annotation.lastWord} )\n`;
    });

    // This is just to demonstrate the generated text in this example
    alert(commentsText);

    var blob = new Blob([commentsText], { type: "text/plain;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  });
}

async function stichToPdf() {
  let sortedAnnotations = [];

  for (let page in annotations) {
    annotations[page].forEach((annotation) => {
      annotation.page = page; // Add the page number to each annotation
      sortedAnnotations.push(annotation);
    });
  }
  sortedAnnotations.sort((a, b) => {
    if (a.page === b.page) {
      return a.boundingBoxNumber - b.boundingBoxNumber;
    }
    return a.page - b.page;
  });
  let decryptedPdfBuffer;

  // Attempt to decrypt the PDF if it's password-protected
  try {
    const pdfDoc = await pdfjsLib.getDocument({ data: uploadedPdfBuffer })
      .promise;
    decryptedPdfBuffer = await pdfDoc.getData();
  } catch (err) {
    if (err.name === "PasswordException") {
      const password = prompt(
        "This document is password protected. Enter the password:"
      );
      if (!password) {
        alert("No password provided. Unable to proceed.");
        return;
      }
      const pdfDoc = await pdfjsLib.getDocument({
        data: uploadedPdfBuffer,
        password: password,
      }).promise;
      decryptedPdfBuffer = await pdfDoc.getData();
    } else {
      console.error("Failed to load or decrypt PDF:", err);
      return;
    }
  }

  const pdfDoc1 = await PDFLib.PDFDocument.load(decryptedPdfBuffer);
  const [pageWidth, pageHeight] = [600, 800];
  const newPage = pdfDoc1.addPage([pageWidth, pageHeight]);
  let x = 50;
  let y = pageHeight - 100;

  sortedAnnotations.forEach((annotation) => {
    const comment = `Page ${annotation.page}:\nfor topic "${annotation.firstWord}...${annotation.lastWord}" Reviewer said "${annotation.comment} at line number ${annotation.boundingBoxNumber}" (ref. ${annotation.region},${annotation.y})\n`;
    newPage.drawText(comment, {
      x: x,
      y: y,
      size: 10,
      color: PDFLib.rgb(0, 0, 0),
    });
    y -= 50;
  });
  const modifiedPdfBytes = await pdfDoc1.save();

  // Download the modified PDF
  const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "modified.pdf";
  link.click();
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadedPdfBuffer = e.target.result;
    };
    reader.readAsArrayBuffer(file);
  }
  document.getElementById("pdf-stitch").disabled = false;
}

async function handleTessButtonClick() {
  // Check if the page has already been scanned
  if (scannedPages.includes(pageNum)) {
    checkAnnotationsInBoundingBox();
    console.log(`Page ${pageNum} has already been scanned.`);
    return;
  }
  // Clear previous bounding boxes
  boundingBoxes = [];
  const button = document.getElementById("next-page");

  try {
    const result = await Tesseract.recognize(canvas, "eng", {
      logger: (m) => {
        console.log(m);
        if (m.status === "recognizing text") {
          button.style.setProperty("--primary-color", "green"); // or any other style changes you want
          button.textContent = "Processing...";
        }
      },
    });

    const { lines } = result.data;

    // Use paragraphs instead of blocks
    button.style.setProperty("--primary-color", "red"); // reset to default color
    button.textContent = "Next-Page"; // or whatever the original text was
    lines.forEach((line, index) => {
      // Get the bounding box for the paragraph
      const {
        bbox: { x0, y0, x1, y1 },
      } = line;

      // Check if the paragraph is likely bold using a criterion, e.g., confidence

      // Draw the bounding box on the canvas
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.lineWidth = 0.1;
      ctx.strokeStyle = "red"; // Set color based on boldness
      ctx.stroke();

      // Draw the serial number inside the box
      ctx.fillStyle = "blue";
      ctx.fillText(index + 1, x0 + 5, y0 + 15);

      // Store the bounding box for later use
      boundingBoxes.push({
        x0,
        y0,
        x1,
        y1,
        number: index + 1,
        text: line.text, // Store the paragraph text
      });
    });

    // If you want to log the extracted paragraphs to the console:
    lines.forEach((line, index) => {
      console.log(`Paragraph ${index + 1}:`, line.text);
    });
    scannedPages.push(pageNum);
    checkAnnotationsInBoundingBox();
  } catch (err) {
    console.error(err);
  }
}

canvas.addEventListener("mousemove", function (event) {
  const x = event.clientX - canvas.getBoundingClientRect().left;
  const y = event.clientY - canvas.getBoundingClientRect().top;

  // Check if the mouse is inside any of the bounding boxes
  for (const box of boundingBoxes) {
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) {
      // Display tooltip with the box number (or you can customize this part as needed)
      canvas.title = `Box Number: ${box.number}, Text: ${box.text}, Confidence: ${box.confidence}, Bounding Box: (${box.x0}, ${box.y0}) - (${box.x1}, ${box.y1})`;
      return;
    }
  }

  // Clear tooltip if not hovering over any box
  canvas.title = "";
});

// Get the region name based on the x and y coordinates 1left, 2right, 3left, 4right...

function getRegion(x, y) {
  const numRows = 1;
  const numCols = 2;
  const rowHeight = canvas.height / numRows;
  const colWidth = canvas.width / numCols;

  const rowNumber = Math.floor(y / rowHeight) + 1; // Row number starts from 1
  const colLetter = x < colWidth ? "Left" : "Right"; // Left if x < colWidth, right otherwise

  return `${colLetter}`;
}

// Example usage
canvas.addEventListener("click", function (event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const region = getRegion(x, y);

  console.log(`Clicked region: ${region}`); // Will print the region name
});

function toggleTemplateInput() {
  const container = document.getElementById("templateContainer");
  if (container.style.display === "none") {
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

// local storage code
function saveProgress() {
  // Deep copy annotations and remove DOM elements before saving to local storage
  const annotationsCopy = JSON.parse(JSON.stringify(annotations));
  for (let page in annotationsCopy) {
    annotationsCopy[page] = annotationsCopy[page].map((annotation) => {
      const { element, ...rest } = annotation;
      return rest;
    });
  }

  localStorage.setItem(
    "pdfAnnotationsProgress",
    JSON.stringify(annotationsCopy)
  );
}

function clearAnnotationsFromPage() {
  const container = document.getElementById("pdf-container");
  const existingAnnotations = container.getElementsByClassName("star");
  while (existingAnnotations.length > 0) {
    container.removeChild(existingAnnotations[0]);
  }
}

function renderStoredAnnotations(annotationsForPage) {
  clearAnnotationsFromPage();
  annotationsForPage.forEach((annotation) => {
    const star = createStarElement(
      annotation.x,
      annotation.y,
      `Heading: ${annotation.heading}\nComment: ${annotation.comment}`
    );
    console.log(annotationsForPage);
    document.getElementById("pdf-container").appendChild(star);
    annotation.element = star;
  });
}
function loadProgress() {
  const savedProgress = localStorage.getItem("pdfAnnotationsProgress");
  if (savedProgress) {
    annotations = JSON.parse(savedProgress);
    if (annotations[pageNum]) {
      renderStoredAnnotations(annotations[pageNum]);
      document.getElementById("generate-comments").disabled = false;
    }
  }
}

function clearSavedProgress() {
  localStorage.removeItem("pdfAnnotationsProgress");
}

function toggleMenu() {
  const topBar = document.querySelector(".navbar .top-bar");
  if (topBar.style.display === "none" || !topBar.style.display) {
    topBar.style.display = "flex";
  } else {
    topBar.style.display = "none";
  }
}

function recreateDOMElementForAnnotation(annotation) {
  const star = createStarElement(
    annotation.x,
    annotation.y,
    `Heading: ${annotation.heading}\nComment: ${annotation.comment}`
  );
  document.getElementById("pdf-container").appendChild(star);
  return star;
}

document.getElementById("fileUpload").addEventListener("change", () => {
  clearAnnotations();
  const fileInput = document.getElementById("fileUpload");
  const file = fileInput.files[0];

  if (file) {
    const savedProgressExists =
      localStorage.getItem("pdfAnnotationsProgress") !== null;

    if (savedProgressExists) {
      const continueFromLastProgress = window.confirm(
        "Do you want to continue from the last saved progress or do you want to upload a new file? Click 'OK' to continue from last progress or 'Cancel' to upload a new file."
      );
      if (continueFromLastProgress) {
        console.log("pass");
      } else {
        const areYouSure = window.confirm(
          "Are you sure? Your last progress made to the file will be lost."
        );
        if (areYouSure) {
          clearSavedProgress();
        } else {
          console.log("bolo pencil");
          return;
        }
      }
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      const newUrl = e.target.result;

      pdfjsLib
        .getDocument(newUrl)
        .promise.then((pdfDoc_) => {
          pdfDoc = pdfDoc_;
          document.querySelector("#page-count").textContent = pdfDoc.numPages;

          annotations = {};
          pageNum = 1;
          renderPage(pageNum);

          loadProgress();
          handleTessButtonClick();
        })
        .catch((err) => {
          if (err.name === "PasswordException") {
            const password = prompt(
              "This document is password protected. Enter the password:"
            );
            if (password) {
              pdfjsLib
                .getDocument({ url: newUrl, password: password })
                .promise.then((pdfDoc_) => {
                  pdfDoc = pdfDoc_;
                  document.querySelector("#page-count").textContent =
                    pdfDoc.numPages;

                  annotations = {};
                  pageNum = 1;
                  renderPage(pageNum);

                  loadProgress();
                  handleTessButtonClick();
                })
                .catch((innerErr) => {
                  if (innerErr.name === "PasswordException") {
                    const retry = confirm(
                      "Wrong password. Would you like to try again?"
                    );
                    if (retry) {
                      const newPassword = prompt("Re-enter the password:");
                      if (newPassword) {
                        pdfjsLib
                          .getDocument({ url: newUrl, password: newPassword })
                          .promise.then((pdfDoc_) => {
                            // ... (handle the PDF as before)
                          })
                          .catch((retryErr) => {
                            console.error(retryErr);
                            alert(
                              "Failed to open the document with the provided password."
                            );
                          });
                      } else {
                        alert(
                          "No password provided. Unable to open the document."
                        );
                      }
                    } else {
                      alert("Operation cancelled.");
                    }
                  } else {
                    console.error(innerErr);
                  }
                });
            } else {
              alert("No password provided. Unable to open the document.");
            }
          } else {
            console.error(err);
          }
        });
    };

    reader.readAsDataURL(file);
  } else {
    alert("Please select a PDF file to upload.");
  }
});

document.querySelector("#prev-page").addEventListener("click", showPrevPage);
document.querySelector("#next-page").addEventListener("click", showNextPage);
document
  .querySelector("#generate-comments")
  .addEventListener("click", generateComments);

function showDialog() {
  const dialog = document.querySelector(".annotation-dialog");
  dialog.classList.add("visible");
}

function hideDialog() {
  const dialog = document.querySelector(".annotation-dialog");
  dialog.classList.remove("visible");
}
