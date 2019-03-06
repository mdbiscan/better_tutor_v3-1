import React, { Component } from "react";
import { Tab, Tabs } from "react-bootstrap";
import DataTable from "./components/DataTable";
import DropSelect from "./components/DropSelect";
import Btn from "./components/Btn";
import ActiveSession from "./components/ActiveSession";
import SaveModal from "./components/SaveModal";

import uniqid from "uniqid";
import API from "./services/API";
import { filter, obj } from "./utils";
import "./App.css";

class App extends Component {
  state = {
    sessionData: [],
    rosterData: [],
    updated: [],
    activeSession: null,
    tab: "todaysSessions",
    show: false
  };
  componentDidMount() {
    this.fetchSessionData();
    this.fetchRosterData();
  }
  modalToggle = () => {
    this.setState({ show: !this.state.show });
  };

  fetchSessionData = async () => {
    try {
      const sessionRes = await API.getSheetData(1);
      const sessionData = await sessionRes.data;
      sessionData.forEach((record, i) => (record.index = i));
      return this.setState({ sessionData });
    } catch (err) {
      throw new Error(err);
    }
  };

  fetchRosterData = async () => {
    try {
      const rosterRes = await API.getSheetData(3);
      const rosterData = await rosterRes.data;
      rosterData.forEach((record, i) => (record.index = i));
      return this.setState({ rosterData });
    } catch (err) {
      throw new Error(err);
    }
  };

  findSessionNotes = (studentEmail, index) => {
    const sessionData = this.state.sessionData;
    for (let i = index - 1; i >= 0; i--) {
      if (sessionData[i].studentEmail === studentEmail) {
        return sessionData[i].notes;
      }
    }
  };

  //this is probably a little sloppy. The idea is to save the indices of updated object to later do a batch update on the backend on save or componentWillUnmount
  handleRowUpdate = (data, table) => {
    const indexRef = data.index;
    const tableData = [...this.state[table]];
    const updated = [...this.state.updated];
    if (!updated.includes(indexRef)) {
      updated.push(indexRef);
    }
    tableData[indexRef] = data;
    this.setState({ [table]: tableData, updated });
  };

  handleOnSave = tableName => {
    const updates = [];
    this.state.updated.forEach(indexRef => {
      updates.push(this.state[tableName][indexRef]);
    });
    API.updateSheet(updates, tableName).then(() => {
      if (this.state.show) {
        this.setState({ updated: [], show: false });
      } else {
        this.setState({ updated: [] });
      }
    });
  };

  //how do we get this to rerender the dataTable properly? It would be easy enough to remove a new session or new student row from the end..
  //but what about changes random cells of the table.. I believe the original state based on the API call is being changed on edit..
  handleDiscardChanges = () => {
    const sessionData = this.state.sessionData.filter(
      session => !session.hasOwnProperty("newRow")
    );
    this.setState({ sessionData, updated: [], show: false });
  };

  handleAddStudent = () => {
    const rosterData = [...this.state.rosterData];
    const updated = [...this.state.updated];
    const rowData = { ...this.state.rosterData[0] };
    obj.placeholderObj(rowData);
    this.handleAddRow("rosterData", rosterData, rowData, updated);
  };

  handleAddSession = eventKey => {
    const sessionData = [...this.state.sessionData];
    const rowData = filter.findStudent(eventKey, this.state.rosterData);
    rowData.b2b = "N";
    rowData.showNoShow = "Show";
    obj.mergeObjects(sessionData[0], rowData);
    this.handleAddRow("sessionData", sessionData, rowData);
  };

  handleAddRow = (table, data, newRow) => {
    const updated = [...this.state.updated];
    const newIndex = data.length;
    newRow.index = newIndex;
    newRow.newRow = true;
    newRow.sessionId = uniqid();
    data.push(newRow);
    updated.push(newIndex);
    this.setState({ [table]: data, updated });
  };

  handleRowDelete = id => {
    API.deleteRow(id);
    const sessionData = this.state.sessionData.filter(
      session => session.sessionId !== id
    );
    this.setState({ sessionData });
  };

  handleStartSession = activeSession => {
    //do we need to even save all of this active session data in state?? can I just do state.activeSession: true?
    //then from here could we pass the row data directly to renderActiveSession?
    if (!this.state.activeSession) {
      this.setState({ activeSession });
    }
  };

  renderTodaysSession = () => {
    const data = filter.filterTodaysSessions(this.state.sessionData);
    if (data.length === 0) {
      return <h1 className="no-sessions">Sorry, no sessions today</h1>;
    } else {
      return (
        <DataTable
          data={data}
          sessions={true}
          todaysSessions={true}
          tableName="sessionData"
          handleRowUpdate={this.handleRowUpdate}
          handleStartSession={this.handleStartSession}
        />
      );
    }
  };
  //pretty sure the sessions arg is now obsolete?
  renderDataTable = (table, sessions = false) => {
    return this.state[table].length > 0 ? (
      <DataTable
        tableName={table}
        sessions={sessions}
        data={this.state[table]}
        handleRowUpdate={this.handleRowUpdate}
        handleRowDelete={this.handleRowDelete}
      />
    ) : (
      <h1>Fetching Table Data</h1>
    );
  };

  renderDropSelect = () => {
    return this.state.rosterData.length > 0 ? (
      <DropSelect
        title="Add Session"
        onSelect={this.handleAddSession}
        options={filter.filterNames(this.state.rosterData)}
      />
    ) : null;
  };

  renderAddStudentBtn = () => (
    <Btn variant="primary" onClick={this.handleAddStudent} text="Add Student" />
  );

  renderSaveBtn = table => {
    return this.state.updated.length > 0 ? (
      <Btn
        variant="success"
        text="save"
        onClick={() => this.handleOnSave(table)}
      />
    ) : null;
  };

  renderActiveSession = () => {
    //this component already has the whole list of session, so we should probs just find the previous session notes from here and make ActiveSession stateless
    const studentData = { ...this.state.activeSession };
    const { studentEmail, index } = studentData;
    const prevNotes = this.findSessionNotes(studentEmail, index);
    studentData.prevNotes = prevNotes;
    return <ActiveSession studentData={studentData} />;
  };

  renderSaveModal = () => {
    const { tab } = this.state;
    const table =
      this.state.tab === "todaysSession" || tab === "allSessions"
        ? "sessionData"
        : "rosterData";
    return (
      <SaveModal
        table={table}
        show={this.state.show}
        modalToggle={this.modalToggle}
        handleDiscardChanges={this.handleDiscardChanges}
        handleSaveChanges={this.handleOnSave}
      />
    );
  };
  handleTabSelect = tab => {
    if (this.state.updated.length === 0) {
      this.setState({ tab });
    } else {
      this.modalToggle();
    }
  };

  render() {
    console.log(filter);

    return (
      <>
        {this.state.show && this.renderSaveModal()}
        <Tabs activeKey={this.state.tab} onSelect={this.handleTabSelect}>
          <Tab eventKey="todaysSessions" title="Today's Sessions">
            {this.renderTodaysSession()}
            {this.renderSaveBtn("sessionData")}
            {this.state.activeSession && this.renderActiveSession()}
          </Tab>
          <Tab eventKey="allSessions" title="All Sessions">
            {this.renderDataTable("sessionData", true)}
            {this.state.updated.length > 0
              ? this.renderSaveBtn("sessionData")
              : this.renderDropSelect()}
          </Tab>
          <Tab eventKey="roster" title="Roster">
            {this.renderDataTable("rosterData")}
            {this.state.updated.length > 0
              ? this.renderSaveBtn("rosterData")
              : this.renderAddStudentBtn()}
          </Tab>
        </Tabs>
      </>
    );
  }
}

export default App;
